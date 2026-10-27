from app.db import _connect



################### RETRIEVES THE STATUS ###############################


# Status, last output and cost for every agent, for the agent cards on the front page
def agent_status(names: list[str]) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT current_agent FROM tasks WHERE status = 'running' AND current_agent IS NOT NULL"
        ).fetchall()
        working = {row[0] for row in rows}
        status = []
# Looks up the last output and the costs for one agent at a time
        for name in names:
            last = conn.execute(
                "SELECT id, results ->> %s FROM tasks WHERE results ? %s ORDER BY id DESC LIMIT 1",
                (name, name),
            ).fetchone()
            last_id = last[0] if last else None
            last_cost, total_cost = conn.execute(
                "SELECT COALESCE(SUM(cost_usd) FILTER (WHERE task_id = %s), 0)::float, "
                "COALESCE(SUM(cost_usd), 0)::float FROM usage WHERE agent = %s",
                (last_id, name),
            ).fetchone()
            status.append({
                "name": name,
                "working": name in working,
                "last_task_id": last_id,
                "last_output": (last[1] or "")[:300] if last else "",
                "last_task_cost_usd": last_cost,
                "total_cost_usd": total_cost,
            })
    return status