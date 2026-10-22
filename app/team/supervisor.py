from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field
from app.config import get_llm
from app.usage import track


############# SUPERVISOR AGENT FILE ##################################


NAME = "supervisor"



class Route(BaseModel):
    next: Literal["researcher", "writer", "FINISH"]
    reason: str = Field(description="One sentence on why this is the right next step")


SYSTEM = SystemMessage(content=(
    "You lead a small team and decide who works next.\n"
    "- researcher: finds jobs I have received, and facts about companies on the web\n"
    "- writer: writes a cover letter draft for one job, using the research\n"
    "- FINISH: the task is done, or nobody on the team can help\n\n"
    "Rules. Writer needs research about the job first. "
    "Do not send work to an agent whose output is already there. "
    "If the task is only a question, research may be enough."
    ))
llm = get_llm("ollama").with_structured_output(Route, include_raw=True)


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
    return {"next": route.next, "route_log": [f"{route.next}: {route.reason}"]}