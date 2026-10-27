import logging
import os
import psycopg
from app.context import current_task
from app.routines import run_due_routines
from app.taskqueue import claim_next, fail, finish, save_progress
from app.team.graph import final_answer, stream_task
from app.tracing import trace_config



########################### FILE FOR THE WORKERS #######################################

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("hephaestus.worker")


# Runs one task based on what kind it is, and saves progress after every step
def handle(task_id: int, kind: str, input_text: str) -> tuple[str, list[str]]:
    if kind != "team":
        raise ValueError(f"Unknown task kind: {kind}")
    route, results = [], {}
# Each update is one finished node, for example {"researcher": {"results": {...}}}
    for update in stream_task(input_text, trace_config("team-task", ["team", "queue"])):
        for node, change in update.items():
            route += change.get("route_log", [])
            results.update(change.get("results", {}))
            working = change.get("next") if node == "supervisor" else "supervisor"
            save_progress(task_id, working if working != "FINISH" else None, route, results)
    return final_answer({"route_log": route, "results": results}), route



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
        token = current_task.set(task_id)
        try:
            result, route = handle(task_id, kind, input_text)
            finish(task_id, result, route)
            log.info("Task %s done", task_id)
        except Exception as e:
            fail(task_id, repr(e))
            log.exception("Task %s failed", task_id)
        finally:
            current_task.reset(token)




if __name__ == "__main__":
    main()