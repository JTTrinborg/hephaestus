import os
import secrets
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from app.graph import graph
from app.tracing import trace_config
from langgraph.errors import GraphRecursionError
from app.team.graph import final_answer, run_task
import urllib.request

#### THIS FILE IS FOR THE CONNECTION USING FASTAPI ############

app = FastAPI(title="Hephaestus")


class RunRequest(BaseModel):
    alert_text: str

class RunResponse(BaseModel):
    report: str
    new_jobs: int


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