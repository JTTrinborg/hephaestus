import os
import re
import psycopg
from app.models import Job
from app.context import current_task
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo


TZ = "Australia/Brisbane"

################# DATABASE FOR JOBS ALREADY SENT #################
CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS seen_jobs (
    job_key    TEXT PRIMARY KEY,
    title      TEXT,
    company    TEXT,
    url        TEXT,
    location   TEXT,
    score      INT,
    reason     TEXT,
    first_seen TIMESTAMPTZ DEFAULT now()
);
"""

############### DATABASE FOR COST USAGE ###################################
CREATE_USAGE = """
CREATE TABLE IF NOT EXISTS usage (
    id            SERIAL PRIMARY KEY,
    agent         TEXT,
    model         TEXT,
    input_tokens  INT,
    output_tokens INT,
    cost_usd      NUMERIC(10, 6),
    created_at    TIMESTAMPTZ DEFAULT now()
);
"""

########################## DATABASE FOR THE AGENTS #############################
CREATE_AGENTS = """
CREATE TABLE IF NOT EXISTS agents (
    name          TEXT PRIMARY KEY,
    description   TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    provider      TEXT NOT NULL,
    tools         TEXT[] NOT NULL DEFAULT '{}',
    uses_profile  BOOLEAN NOT NULL DEFAULT false,
    budget_usd    NUMERIC(8, 2),
    active        BOOLEAN NOT NULL DEFAULT true,
    updated_at    TIMESTAMPTZ DEFAULT now()
);
"""


############################# DATABASE TABLE FOR SETTINGS ##################################
CREATE_SETTINGS = """
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


######################## DATABASE FOR THE TASK QUEUE (One row per task) #############################
CREATE_TASKS = """
CREATE TABLE IF NOT EXISTS tasks (
    id          SERIAL PRIMARY KEY,
    kind        TEXT NOT NULL DEFAULT 'team',
    input       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'new',
    result      TEXT,
    route       TEXT[],
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
"""


############################# DATABASE FOR ROUTINE JOBS WITH A TIME OF DAY #################################
CREATE_ROUTINES = """
CREATE TABLE IF NOT EXISTS routines (
    name     TEXT PRIMARY KEY,
    kind     TEXT NOT NULL,
    target   TEXT NOT NULL,
    daily_at TIME NOT NULL,
    active   BOOLEAN NOT NULL DEFAULT true,
    last_run DATE
);
"""



############################ DATABASE FOR PROFILE #####################################
CREATE_PROFILE = """
CREATE TABLE IF NOT EXISTS profile (
    id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    about       TEXT NOT NULL,
    skills_yaml TEXT NOT NULL,
    updated_at  TIMESTAMPTZ DEFAULT now()
);
"""





#DB Connection
def _connect():
    conn = psycopg.connect(os.getenv("DATABASE_URL"))
    conn.execute(CREATE_TABLE)
    conn.execute(CREATE_USAGE)
    conn.execute(CREATE_AGENTS)
    conn.execute(CREATE_SETTINGS)
    conn.execute(CREATE_TASKS)
    conn.execute(CREATE_ROUTINES)
    conn.execute(CREATE_PROFILE)
    conn.execute("ALTER TABLE usage ADD COLUMN IF NOT EXISTS task_id INTEGER")
    conn.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_agent TEXT")
    conn.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS results JSONB")
    return conn

def _key(job: Job) -> str:
    """Stable ID. SEEK job ID when the URL has one, otherwise company and title."""
    match = re.search(r"seek\.com\.au/job/(\d+)", job.url or "")
    if match:
        return f"seek:{match.group(1)}"
    company = re.sub(r"[^a-z0-9]", "", job.company.lower())
    title = re.sub(r"[^a-z0-9]", "", job.title.lower())
    return f"{company}:{title}"

#def _clean(url: str) -> str:
#   """Remove tracking parameters so the same job always gets the same URL."""
#  return url.split("?")[0].rstrip("/")

def init_db() -> None:
    with _connect() as conn:
        conn.execute(CREATE_TABLE)

def filter_new(jobs: list[Job]) -> list[Job]:
    """Return only jobs that have not been sent before."""
    if not jobs:
        return []
    keys = [_key(job) for job in jobs]
    with _connect() as conn:
        rows = conn.execute(
            "SELECT job_key FROM seen_jobs WHERE job_key = ANY(%s)", (keys,)
        ).fetchall()
    seen = {row[0] for row in rows}
    return [job for job in jobs if _key(job) not in seen]


def mark_sent(jobs: list[Job]) -> None:
    """Store jobs so they are never sent again, and so agents can look them up."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO seen_jobs (job_key, title, company, url, location, score, reason) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s) ON CONFLICT (job_key) DO NOTHING",
                [(_key(j), j.title, j.company, j.url, j.location, j.score, j.reason) for j in jobs],
            )


# Stores one model call, linked to the task that is running, if any
def log_usage(agent: str, model: str, tokens_in: int, tokens_out: int, cost: float) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO usage (agent, model, input_tokens, output_tokens, cost_usd, task_id) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (agent, model, tokens_in, tokens_out, cost, current_task.get()),
        )


def month_cost(agent:str) -> float:
    with _connect() as conn:
        row = conn.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) FROM usage "
            "WHERE agent = %s AND created_at >= date_trunc('month', now())",
            (agent,),
        ).fetchone()
    return float(row[0])


def cost_summary() -> str:
    """Markdown section with today's cost per agent and the month total."""
    with _connect() as conn:
        today = conn.execute(
            "SELECT agent, SUM(cost_usd) FROM usage "
            "WHERE created_at >= date_trunc('day', now() AT TIME ZONE %s) AT TIME ZONE %s "
            "GROUP BY agent ORDER BY agent",
            (TZ, TZ),
        ).fetchall()
        month = conn.execute(
            "SELECT COALESCE(SUM(cost_usd), 0) FROM usage "
            "WHERE created_at >= date_trunc('month', now() AT TIME ZONE %s) AT TIME ZONE %s",
            (TZ, TZ),
        ).fetchone()[0]

    lines = ["## Cost", ""]
    lines += [f"- {agent}: ${float(cost):.4f}" for agent, cost in today]
    lines += [f"- **This month:** ${float(month):.4f}"]
    return "\n".join(lines)



# Reads a setting or uses the default if it is missing
def get_setting(key: str, default: str) -> str:
    try:
        with _connect() as conn:
            row = conn.execute("SELECT value FROM settings WHERE key = %s", (key,)).fetchone()
        return row[0] if row else default
# If no DB, such as in CI
    except Exception:
        return default



# Saves a setting, new or changed
def set_setting(key: str, value: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (%s, %s) "
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            (key, value),
        )


# Sums calls, tokens and cost per agent and day, for the cost charts
def daily_usage(days: int = 30) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT (created_at AT TIME ZONE 'Australia/Brisbane')::date AS day, agent, "
            "COUNT(*), SUM(input_tokens), SUM(output_tokens), SUM(cost_usd)::float "
            "FROM usage WHERE created_at > now() - make_interval(days => %s) "
            "GROUP BY day, agent ORDER BY day, agent",
            (days,),
        ).fetchall()
    keys = ["day", "agent", "calls", "input_tokens", "output_tokens", "cost_usd"]
    return [dict(zip(keys, row)) for row in rows]


# Total cost today, this week, this month and all time, in Brisbane time
def usage_summary() -> dict:
    now = datetime.now(ZoneInfo("Australia/Brisbane"))
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week = today - timedelta(days=today.weekday())
    month = today.replace(day=1)
    with _connect() as conn:
        row = conn.execute(
            "SELECT COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= %s), 0)::float, "
            "COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= %s), 0)::float, "
            "COALESCE(SUM(cost_usd) FILTER (WHERE created_at >= %s), 0)::float, "
            "COALESCE(SUM(cost_usd), 0)::float FROM usage",
            (today, week, month),
        ).fetchone()
    return dict(zip(["today", "week", "month", "all_time"], row))



# Reads my profile and skills, or None if they are not saved yet
def get_profile_row() -> tuple[str, str] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT about, skills_yaml FROM profile WHERE id = 1"
        ).fetchone()
    return (row[0], row[1]) if row else None


# Saves my profile and skills, new or changed
def save_profile(about: str, skills_yaml: str) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO profile (id, about, skills_yaml) VALUES (1, %s, %s) "
            "ON CONFLICT (id) DO UPDATE SET about = EXCLUDED.about, "
            "skills_yaml = EXCLUDED.skills_yaml, updated_at = now()",
            (about, skills_yaml),
        )