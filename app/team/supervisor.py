import os
from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import Field, create_model
from app.config import get_llm
from app.registry import AgentSpec
from app.usage import track


############# SUPERVISOR AGENT FILE ##################################


NAME = "supervisor"
# The supervisor instructions, the team is filled in from the registry
TEMPLATE = (
    "You lead a small team and decide who works next.\n"
    "{team}\n"
    "- FINISH: stop\n\n"
    "Choose FINISH when\n"
    "- the task is a question and any agent has answered it\n"
    "- the task asked for written text and it has been written\n"
    "- the task is small talk, or nobody on the team can do it\n\n"
    "Respect what each agent needs before it can work. Never pick an agent that is already done.\n\n"
    "Examples\n"
    "Task: What does Atlassian do? Nothing done -> the agent that finds facts\n"
    "Task: What does Atlassian do? Facts found -> FINISH\n"
    "Task: Good morning, and no agent handles small talk -> FINISH\n"
    "Task: something no agent's description covers -> FINISH"
)



# Builds a supervisor that knows the current team
def build_supervisor(specs: list[AgentSpec]):
    base_llm = get_llm(os.getenv("SUPERVISOR_PROVIDER", "ollama"))
# Looks at what is done and picks who works next, among agents not done yet
    def supervisor(state: dict) -> dict:
        done = state["results"]
        available = [s for s in specs if s.name not in done]
# The only answers allowed, agents not done yet or FINISH
        Route = create_model(
            "Route",
            next=(Literal[tuple([s.name for s in available] + ["FINISH"])], ...),
            reason=(str, Field(description="One sentence on why this is the right next step")),
        )
        llm = base_llm.with_structured_output(Route, include_raw=True)
        team = "\n".join(f"- {s.name}: {s.description}" for s in available)
        system = SystemMessage(content=TEMPLATE.format(team=team))
        status = f"Task: {state['task']}\nAlready done: {', '.join(done) or 'nothing yet'}"
        result = llm.invoke([system, HumanMessage(content=status)])
        track(NAME, result["raw"])
        route = result["parsed"]
        if route is None:
            return {"next": "FINISH", "route_log": ["FINISH: could not parse supervisor output"]}
        return {"next": route.next, "route_log": [f"{route.next}: {route.reason}"]}

    return supervisor
