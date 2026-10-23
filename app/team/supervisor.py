from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from app.config import get_llm
from app.usage import track
import os


############# SUPERVISOR AGENT FILE ##################################


NAME = "supervisor"



class Route(BaseModel):
    next: Literal["researcher", "writer", "FINISH"]
    reason: str = Field(description="One sentence on why this is the right next step")


SYSTEM = SystemMessage(content=(
    "You lead a small team and decide who works next.\n"
    "- researcher: finds jobs I have received, and facts about companies on the web\n"
    "- writer: writes a cover letter or a note for one job. Only when the task asks for written text\n"
    "- FINISH: stop\n\n"
    "Choose FINISH when\n"
    "- the task is a question and research is done\n"
    "- the task asked for written text and the draft is done\n"
    "- the task is small talk, or something the team cannot do\n\n"
    "Examples\n"
    "Task: What does Atlassian do? Research done: no -> researcher\n"
    "Task: What does Atlassian do? Research done: yes -> FINISH\n"
    "Task: Write a cover letter for my best job. Research done: yes. Draft done: no -> writer\n"
    "Task: Good morning -> FINISH\n"
    "Task: Order a pizza -> FINISH"
))
llm = get_llm(os.getenv("SUPERVISOR_PROVIDER", "ollama")).with_structured_output(Route, include_raw=True)


def supervisor(state: dict) -> dict:
    status = (
        f"Task: {state['task']}\n"
        f"Research done: {'yes' if state.get('research') else 'no'}\n"
        f"Draft done: {'yes' if state.get('draft') else 'no'}"
    )
    result = llm.invoke([SYSTEM, HumanMessage(content=status)])
    track(NAME, result["raw"])
    route = result["parsed"]
    if route is None:
        return {"next": "FINISH", "route_log": ["FINISH: could not parse supervisor output"]}
    repeat = (route.next == "researcher" and state.get("research")) or (route.next == "writer" and state.get("draft"))
    if repeat:
        return {"next": "FINISH", "route_log": [f"FINISH: blocked repeat of {route.next}"]}
    return {"next": route.next, "route_log": [f"{route.next}: {route.reason}"]}
