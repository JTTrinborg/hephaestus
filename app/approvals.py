import json
import os
import urllib.request
from psycopg.types.json import Jsonb
from app.context import current_task
from app.db import _connect




################# THE FILE FOR THE HUMAN APPROVALS ###################################
# Sends an email through the n8n send-mail workflow
def send_email(payload: dict) -> str:
    request = urllib.request.Request(
        "http://n8n:5678/webhook/send-mail",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "X-Webhook-Key": os.getenv("N8N_WEBHOOK_KEY", "")},
    )
    urllib.request.urlopen(request, timeout=30)
    return f"Sent to {payload['to']}"


# The actions that can be approved, and the code that carries each one out
ACTIONS = {"send_email": send_email}



# Stores an action for approval and returns its number. Nothing is carried out yet
def request_approval(action: str, payload: dict) -> int:
    if action not in ACTIONS:
        raise ValueError(f"Unknown action: {action}")
    with _connect() as conn:
        return conn.execute(
            "INSERT INTO approvals (task_id, action, payload) VALUES (%s, %s, %s) RETURNING id",
            (current_task.get(), action, Jsonb(payload)),
        ).fetchone()[0]



# Lists approvals, only those with one status if given
def list_approvals(status: str | None = None) -> list[dict]:
    keys = ["id", "task_id", "action", "payload", "status", "result", "created_at", "decided_at"]
    with _connect() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(keys)} FROM approvals "
            "WHERE %(status)s::text IS NULL OR status = %(status)s ORDER BY id DESC LIMIT 100",
            {"status": status},
        ).fetchall()
    return [dict(zip(keys, row)) for row in rows]



# Approves or rejects a pending action. Approved actions are carried out by code, not by a model
def decide(approval_id: int, approve: bool) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "UPDATE approvals SET status = %s, decided_at = now() "
            "WHERE id = %s AND status = 'pending' RETURNING action, payload",
            ("approved" if approve else "rejected", approval_id),
        ).fetchone()
    if row is None:
        return None
    action, payload = row
    if not approve:
        return {"id": approval_id, "status": "rejected"}
    try:
        result, status = ACTIONS[action](payload), "approved"
    except Exception as e:
        result, status = repr(e), "failed"
    with _connect() as conn:
        conn.execute("UPDATE approvals SET status = %s, result = %s WHERE id = %s", (status, result, approval_id))
    return {"id": approval_id, "status": status, "result": result}