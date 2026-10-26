import os
import secrets
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from app.graph import graph
from app.tracing import trace_config
from langgraph.errors import GraphRecursionError
from app.team.graph import final_answer, run_task
from app.registry import AgentSpec, list_agents, upsert_agent
from app.tools.registry import TOOLS
from app.taskqueue import enqueue, get_task
import urllib.request

#### THIS FILE IS FOR THE CONNECTION USING FASTAPI ############

app = FastAPI(title="Hephaestus")


class RunRequest(BaseModel):
    alert_text: str

class RunResponse(BaseModel):
    report: str
    new_jobs: int

# The body for turning an agent on or off
class ActiveRequest(BaseModel):
    active: bool


def check_key(x_api_key: str) -> None:
    """Reject the call unless the header matches FASTAPI_KEY in .env."""
    expected = os.getenv("FASTAPI_KEY")
    if not expected or not secrets.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Invalid API key")

@app.get("/ready")
def ready():
    """Ready only when the API can reach Ollama."""
    try:
        urllib.request.urlopen(os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"), timeout=3)
    except Exception:
        raise HTTPException(status_code=503, detail="Ollama not reachable")
    return {"status": "ready"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/run", response_model=RunResponse)
def run(req: RunRequest, x_api_key: str = Header()):
    check_key(x_api_key)
    result = graph.invoke({"alert_text": req.alert_text}, config=trace_config("morning-jobs", ['job-search'])) # Hardcoded for now
    return RunResponse(report=result["report"], new_jobs=len(result["jobs"]))


############ CODE FOR THE TEAM #####################################

class TaskRequest(BaseModel):
    task: str

class TaskResponse(BaseModel):
    answer: str
    route: list[str]

@app.post("/task", response_model=TaskResponse)
def task(req: TaskRequest, x_api_key: str = Header()):
    check_key(x_api_key)
    try:
        result = run_task(req.task, trace_config("team-task", ["team"]))
    except GraphRecursionError:
        raise HTTPException(status_code=508, detail="The team went in circles and were stopped")
    return TaskResponse(
        answer=final_answer(result),
        route=result["route_log"],
    )



########################## CODE FOR SAVE, CHANGE OR TURNING OFF AN AGENT WITH API #################################
# List all agents, also those turned off
@app.get("/agents", response_model=list[AgentSpec])
def get_agents(x_api_key: str = Header()):
    check_key(x_api_key)
    return list_agents(active_only=False)


# Creates or changes an agent
@app.put("/agents/{name}", response_model=AgentSpec)
def put_agent(name: str, spec: AgentSpec, x_api_key: str = Header()):
    check_key(x_api_key)
    if spec.name != name:
        raise HTTPException(status_code=400, detail="Name in the URL and the body must match")
    unknown= [t for t in spec.tools if t not in TOOLS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown tools: {unknown}")
    upsert_agent(spec)
    return spec



# Turns an agent on or off
@app.patch("/agents/{name}", response_model=AgentSpec)
def set_active(name: str, req: ActiveRequest, x_api_key: str = Header()):
    check_key(x_api_key)
    spec = next((s for s in list_agents(active_only=False) if s.name == name), None)
    if spec is None:
        raise HTTPException(status_code=404, detail="No agent with that name")
    spec.active = req.active
    upsert_agent(spec)
    return spec


################################## CODE FOR TASKS ####################################################
# Puts a task in the queue and returns its number at once
@app.post("/tasks")
def create_task(req: TaskRequest, x_api_key: str = Header()):
    check_key(x_api_key)
    return {"id" : enqueue(req.task)}



# Shows the status and answer for one task
@app.get("/tasks/{task_id}")
def read_task(task_id: int, x_api_key: str = Header()):
    check_key(x_api_key)
    task = get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="No task with that ID")
    return task