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
from app.db import daily_usage, usage_summary, get_profile_row, save_profile, get_setting, set_setting
from app.taskqueue import list_tasks
from app.status import agent_status
from app.profile import from_files
from app.routines import list_routines, update_routine
from datetime import time
import yaml
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

# The body for saving my profile
class ProfileUpdate(BaseModel):
    about: str
    skills_yaml: str

# The body for changing one setting
class SettingRequest(BaseModel):
    value: str

# The body for changing a routine, both fields are optional
class RoutineUpdate(BaseModel):
    daily_at: time | None = None
    active: bool | None = None


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


# List the newest tasks, without the full answer
@app.get("/tasks")
def get_tasks(limit: int = 50, x_api_key: str = Header()):
    check_key(x_api_key)
    return list_tasks(min(limit, 200))


#################### CODE FOR COST #################################
# Cost and tokens per agent and day for the last days
@app.get("/usage/daily")
def get_daily_usage(days: int = 30, x_api_key: str = Header()):
    check_key(x_api_key)
    return daily_usage(max(1, min(days, 365)))


# Cost today, this week, this month and all time
@app.get("/usage/summary")
def get_usage_summary(x_api_key: str = Header()):
    check_key(x_api_key)
    return usage_summary()


################# CODE FOR AGENT STATUS ######################
# Live status for every agent, for the cards on the front page
@app.get("/agents/status")
def get_agent_status(x_api_key: str = Header()):
    check_key(x_api_key)
    names = ["supervisor"] + [s.name for s in list_agents()]
    return agent_status(names)



###################### CODE FOR PROFILE ######################
# Shows my profile and skills as they are stored
@app.get("/profile")
def get_profile(x_api_key: str = Header()):
    check_key(x_api_key)
    about, skills = get_profile_row() or from_files()
    return {"about": about, "skills_yaml": skills}


# Saves my profile, if the skills are valid YAML with a skills list
@app.put("/profile")
def put_profile(req: ProfileUpdate, x_api_key: str = Header()):
    check_key(x_api_key)
    try:
        parsed = yaml.safe_load(req.skills_yaml) or {}
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")
    if not isinstance(parsed.get("skills"), list):
        raise HTTPException(status_code=400, detail="skills_yaml must contain a list called skills")
    save_profile(req.about, req.skills_yaml)
    return {"saved": True}



########################## CODE FOR SETTINGS #############################
SETTINGS = {
    "supervisor_provider": ({"anthropic", "ollama", "jev"}, os.getenv("SUPERVISOR_PROVIDER", "ollama")),
    "profile_local_only": ({"true", "false"}, "true"),
}


# Shows the current value of every setting
@app.get("/settings")
def get_settings(x_api_key: str = Header()):
    check_key(x_api_key)
    return {key: get_setting(key, default) for key, (_, default) in SETTINGS.items()}


# Changes one setting, if the key and value are allowed
@app.put("/settings/{key}")
def put_setting(key: str, req: SettingRequest, x_api_key: str = Header()):
    check_key(x_api_key)
    if key not in SETTINGS:
        raise HTTPException(status_code=404, detail="No setting with that name")
    allowed, _ = SETTINGS[key]
    if req.value not in allowed:
        raise HTTPException(status_code=400, detail=f"Allowed values: {sorted(allowed)}")
    set_setting(key, req.value)
    return {key: req.value}



################## CODE FOR ROUTINES ############################
# Lists all routines with time of day and last run
@app.get("/routines")
def get_routines(x_api_key: str = Header()):
    check_key(x_api_key)
    return list_routines()


# Changes the time of day or turns a routine on or off
@app.patch("/routines/{name}")
def patch_routine(name: str, req: RoutineUpdate, x_api_key: str = Header()):
    check_key(x_api_key)
    if not update_routine(name, req.daily_at, req.active):
        raise HTTPException(status_code=404, detail="No routine with that name")
    return {"name": name, "updated": req.model_dump(exclude_none=True)}