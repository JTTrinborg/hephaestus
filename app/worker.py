import logging
import os
import psycopg
from app.taskqueue import claim_next, fail, finish
from app.team.graph import final_answer, run_task
from app.tracing import trace_config
from app.routines import run_due_routines


########################### FILE FOR THE WORKERS #######################################

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("hephaestus.worker")


# Runs one task based on what kind it is
def handle(kind: str, input_text: str) -> tuple[str, list[str]]:
    if kind == "team":
        result = run_task(input_text, trace_config("team-task", ["team", "queue"]))
        return final_answer(result), result["route_log"]
    raise ValueError(f"Unknown task kind: {kind}")



# Keeps the worker running and working through the queue
def main() -> None:
    log.info("worker started")
    listen = psycopg.connect(os.getenv("DATABASE_URL"), autocommit=True)
    listen.execute("LISTEN new_task")
# Sleeps until a new task arrives, or at most 60 seconds, then works through the queue
    while True:
        run_due_routines()
        job = claim_next()
        if job is None:
            for _ in listen.notifies(timeout=60, stop_after=1):
                pass
            continue
        task_id, kind, input_text = job
        log.info("Task %s started", task_id)
        try:
            result, route = handle(kind, input_text)
            finish(task_id, result, route)
            log.info("Task %s done", task_id)
        except Exception as e:
            fail(task_id, repr(e))
            log.exception("Task %s failed", task_id)




if __name__ == "__main__":
    main()