import logging
import os
import urllib.request
from datetime import datetime, time
from zoneinfo import ZoneInfo
from app.db import _connect



########################## FILE FOR THE ROUTINE JOBS ###############################
TZ = ZoneInfo("Australia/Brisbane")
log = logging.getLogger("hephaestus.routines")



# Checks that Ollama answers before work starts
def ollama_ready() -> bool:
    try:
        urllib.request.urlopen(os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"), timeout=3)
        return True
    except Exception:
        return False



# Starts the n8n workflow with the webhook key
def call_webhook(url: str) -> None:
    request = urllib.request.Request(
        url, method="POST", headers={"X-Webhook-Key": os.getenv("N8N_WEBHOOK_KEY", "")}
    )
    urllib.request.urlopen(request, timeout=10)



# Starts routines whose time has passed today
def run_due_routines() -> None:
    """Start every active routine whose time has passed today and that has not run today."""
    now = datetime.now(TZ)
    with _connect() as conn:
        due = conn.execute(
            "SELECT name, kind, target FROM routines "
            "WHERE active AND daily_at <= %s AND (last_run IS NULL OR last_run < %s)",
            (now.time(), now.date()),
        ).fetchall()
# Starts each due routine, and tries again later if it fails
    for name, kind, target in due:
        if not ollama_ready():
            log.info("Routine %s is due. Waiting for Ollama", name)
            return
        try:
            if kind == "webhook":
                call_webhook(target)
            with _connect() as conn:
                conn.execute(
                    "UPDATE routines SET last_run = %s, last_started_at = now() WHERE name = %s",
                    (now.date(), name),
                )
            log.info("Routine %s started", name)
        except Exception:
            log.exception("Routine %s failed, will retry", name)



# Gets all routines, for the dashboard
def list_routines() -> list[dict]:
    keys = ["name", "kind", "target", "daily_at", "active", "last_run"]
    with _connect() as conn:
        rows = conn.execute(f"SELECT {', '.join(keys)} FROM routines ORDER BY name").fetchall()
    return [dict(zip(keys, row)) for row in rows]


# Changes the time of day or active for one routine, returns False if it does not exist
def update_routine(name: str, daily_at: time | None = None, active: bool | None = None) -> bool:
    changes = {"daily_at": daily_at, "active": active}
    changes = {column: value for column, value in changes.items() if value is not None}
    if not changes:
        return True
    sets = ", ".join(f"{column} = %s" for column in changes)
    with _connect() as conn:
        cursor = conn.execute(f"UPDATE routines SET {sets} WHERE name = %s", (*changes.values(), name))
        return cursor.rowcount == 1