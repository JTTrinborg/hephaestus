from app.db import _connect



##################  FILE FOR THE PROJECT SETUP  #############################
# Gets all projects with the number of tasks and their total cost
def list_projects() -> list[dict]:
    keys = ["id", "name", "description", "active", "created_at", "tasks", "cost_usd"]
    with _connect() as conn:
        rows = conn.execute(
            "SELECT p.id, p.name, p.description, p.active, p.created_at, "
            "(SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id), "
            "COALESCE((SELECT SUM(u.cost_usd) FROM usage u JOIN tasks t ON u.task_id = t.id "
            "WHERE t.project_id = p.id), 0)::float "
            "FROM projects p ORDER BY p.active DESC, p.created_at DESC"
        ).fetchall()
    return [dict(zip(keys, row)) for row in rows]



# Creates a project and returns its ID
def create_project(name: str, description: str) -> int:
    with _connect() as conn:
        return conn.execute(
            "INSERT INTO projects (name, description) VALUES (%s, %s) RETURNING id", (name, description)
        ).fetchone()[0]


# Builds a short text with the project goal and what every agent produced in its newest finished tasks
def project_context(project_id: int | None) -> str:
    if project_id is None:
        return ""
    with _connect() as conn:
        project = conn.execute("SELECT name, description FROM projects WHERE id = %s", (project_id,)).fetchone()
        done = conn.execute(
            "SELECT input, results FROM tasks "
            "WHERE project_id = %s AND status = 'done' ORDER BY id DESC LIMIT 5",
            (project_id,),
        ).fetchall()
    if project is None:
        return ""
    # Each earlier task with what every agent produced, shortened, not only the final answer
    earlier = "\n".join(
        f"- {task}\n" + "\n".join(f"  {agent}: {text[:1500]}" for agent, text in (results or {}).items())
        for task, results in reversed(done)
    )
    return f"Project: {project[0]}\nGoal: {project[1]}\nEarlier tasks in this project:\n{earlier or '- none yet'}"