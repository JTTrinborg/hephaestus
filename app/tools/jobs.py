from langchain_core.tools import tool
from app.db import _connect

################ TOOOL TO READ FROM SEEN_JOBS ######################


@tool
def recent_jobs(limit: int = 10) -> str:
    """List jobs from my job alerts in the last 14 days, best score first."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT score, title, company, location, url, reason FROM seen_jobs "
            "WHERE first_seen > now() - interval '14 days' "
            "ORDER BY score DESC NULLS LAST LIMIT %s",
            (limit,),
        ).fetchall()
    if not rows:
        return "No jobs the last 14 days."
    return "\n".join(
        f"- {score}/10 {title} at {company} ({location}) {url}. {reason}"
        for score, title, company, location, url, reason in rows
    )