from app.db import _connect
from psycopg.types.json import Jsonb


###################### FILE FOR THE TASK QUEUES FOR THE AGENTS ################################


# Puts a new task in the queue and returns its number
def enqueue(input_text: str, kind: str = "team") -> int:
    with _connect() as conn:
        task_id = conn.execute(
            "INSERT INTO tasks (kind, input) VALUES (%s, %s) RETURNING id", (kind, input_text)
        ).fetchone()[0]
        conn.execute("NOTIFY new_task")    # wakes the worker at once
        return task_id



# Takes the oldest waiting task so no one else gets it
def claim_next() -> tuple | None:
    """Take the oldest new task and mark it running, so no one else takes it."""
    with _connect() as conn:
        return conn.execute(
            "UPDATE tasks SET status = 'running', started_at = now() "
            "WHERE id = (SELECT id FROM tasks WHERE status = 'new' ORDER BY id "
            "FOR UPDATE SKIP LOCKED LIMIT 1) "
            "RETURNING id, kind, input"
        ).fetchone()



# Marks a task as done and saves the answer, and clears the agent that was working
def finish(task_id: int, result: str, route: list[str]) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE tasks SET status = 'done', current_agent = NULL, result = %s, route = %s, "
            "finished_at = now() WHERE id = %s",
            (result, route, task_id),
        )



# Marks a task as failed and saves the error, and clears the agent that was working
def fail(task_id: int, error: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE tasks SET status = 'failed', current_agent = NULL, error = %s, "
            "finished_at = now() WHERE id = %s",
            (error, task_id),
        )




# Gets one task with its status, answer, the agent working now and the result from each agent
def get_task(task_id: int) -> dict | None:
    keys = ["id", "kind", "input", "status", "current_agent", "result", "results",
            "route", "error", "created_at", "finished_at"]
    with _connect() as conn:
        row = conn.execute(
            f"SELECT {', '.join(keys)} FROM tasks WHERE id = %s", (task_id,)
        ).fetchone()
    return dict(zip(keys, row)) if row else None



# Saves progress while a task runs, so the dashboard can show it live
def save_progress(task_id: int, current_agent: str | None, route: list[str], results: dict) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE tasks SET current_agent = %s, route = %s, results = %s WHERE id = %s",
            (current_agent, route, Jsonb(results), task_id),
        )


# Gets the newest task without their answers, with the agent working now and the cost
def list_tasks(limit: int = 50) -> list[dict]:
    keys = ["id", "kind", "input", "status", "current_agent", "route", "error", "created_at", "started_at", "finished_at", "cost_usd"]
    with _connect() as conn:
        rows = conn.execute(
            "SELECT t.id, t.kind, t.input, t.status, t.current_agent, t.route, t.error, "
            "t.created_at, t.started_at, t.finished_at, "
            "COALESCE((SELECT SUM(u.cost_usd) FROM usage u WHERE u.task_id = t.id), 0)::float "
            "FROM tasks t ORDER BY t.id DESC LIMIT %s",
            (limit,),
        ).fetchall()
    return [dict(zip(keys, row)) for row in rows]