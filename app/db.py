import os
import psycopg
from app.models import Job


################# DATABASE FOR JOBS ALREADY SENT #################
CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS seen_jobs (
    url        TEXT PRIMARY KEY,
    title      TEXT,
    company    TEXT,
    first_seen TIMESTAMPTZ DEFAULT now()
);
"""

#DB Connection
def _connect():
    return psycopg.connect(os.getenv("DATABASE_URL"))

def _clean(url: str) -> str:
    """Remove tracking parameters so the same job always gets the same URL."""
    return url.split("?")[0].rstrip("/")

def init_db() -> None:
    with _connect() as conn:
        conn.execute(CREATE_TABLE)

def filter_new(jobs: list[Job]) -> list[Job]:
    """Return only jobs that have not been sent before."""
    if not jobs:
        return []
    urls = [_clean(job.url) for job in jobs]
    with _connect() as conn:
        rows = conn.execute(
            "SELECT url FROM seen_jobs WHERE url = ANY(%s)", (urls,)
        ).fetchall()
    seen = {row[0] for row in rows}
    return [job for job in jobs if _clean(job.url) not in seen]




def mark_sent(jobs: list[Job]) -> None:
    """Store jobs so they are never sent again."""
    with _connect() as conn:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO seen_jobs (url, title, company) VALUES (%s, %s, %s) "
                "ON CONFLICT (url) DO NOTHING",
                [(_clean(j.url), j.title, j.company) for j in jobs],
            )


init_db()