import os
import re
import psycopg
from app.models import Job


################# DATABASE FOR JOBS ALREADY SENT #################
CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS seen_jobs (
    job_key    TEXT PRIMARY KEY,
    title      TEXT,
    company    TEXT,
    url        TEXT,
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

#DB Connection
def _connect():
    conn = psycopg.connect(os.getenv("DATABASE_URL"))
    conn.execute(CREATE_TABLE)
    conn.execute(CREATE_USAGE)
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
    """Store jobs so they are never sent again."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO seen_jobs (job_key, title, company, url) VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (job_key) DO NOTHING",
                [(_key(j), j.title, j.company, j.url) for j in jobs],
            )


def log_usage(agent: str, model: str, input_tokens: int, output_tokens: int, cost: float) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO usage (agent, model, input_tokens, output_tokens, cost_usd) "
            "VALUES (%s, %s, %s, %s, %s)",
            (agent, model, input_tokens, output_tokens, cost),
        )


init_db()