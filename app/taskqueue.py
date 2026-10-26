from app.db import _connect


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



# Marks a task as done and saves the answer
def finish(task_id: int, result: str, route: list[str]) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE tasks SET status = 'done', result = %s, route = %s, finished_at = now() WHERE id = %s",
            (result, route, task_id),
        )



# Marks a task as failed and saves the error
def fail(task_id: int, error: str) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE tasks SET status = 'failed', error = %s, finished_at = now() WHERE id = %s",
            (error, task_id),
        )



# Gets one task with its status and answer
def get_task(task_id: int) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT id, kind, input, status, result, route, error, created_at, finished_at FROM tasks WHERE id = %s",
            (task_id,),
        ).fetchone()
    keys = ["id", "kind", "input", "status", "result", "route", "error", "created_at", "finished_at"]
    return dict(zip(keys, row)) if row else None