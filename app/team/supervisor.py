import os
from typing import Literal
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import Field, create_model
from app.config import get_llm
from app.db import get_setting
from app.registry import AgentSpec
from app.usage import track, track_tokens


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
    "Respect what each agent needs before it can work.\n\n"
    "Examples\n"
    "Task: What does Atlassian do? Already done: nothing yet -> the agent that answers questions\n"
    "Task: What does Atlassian do? Already done: the agent that answers questions -> FINISH\n"
    "Task: Good morning, and no agent handles small talk -> FINISH\n"
    "Task: something no agent's description covers -> FINISH"
)


# Builds the supervisor with the model chosen in settings
def build_supervisor(specs: list[AgentSpec], provider: str | None = None):
    provider = provider or get_setting("supervisor_provider", os.getenv("SUPERVISOR_PROVIDER", "ollama"))
    if provider == "jev":
        return build_jev_supervisor(specs)
    return build_llm_supervisor(specs, provider)


# Builds a supervisor where a normal language model picks the next agent
def build_llm_supervisor(specs: list[AgentSpec], provider: str):
    base_llm = get_llm(provider)
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



# Builds a supervisor that lets Jev pick the next agent
def build_jev_supervisor(specs: list[AgentSpec]):
    from langchain_typesafe import Choice, TypeSafeClassifier

    classifier = TypeSafeClassifier()
    criteria = {s.name: s.description for s in specs}
    criteria["FINISH"] = "Stop. The task is done, or it is small talk, or nobody on the team can do it"

    # Asks Jev who works next, and how sure it is
    def supervisor(state: dict) -> dict:
        done = state["results"]
        # Only agents not done yet are options, plus FINISH
        options = {name: text for name, text in criteria.items() if name not in done}
        status = f"Task: {state['task']}\nAlready done: {', '.join(done) or 'nothing yet'}"
        response = classifier.invoke({
            "state": status,
            "questions": {
                "next": Choice(
                    instructions="Who should work next?",
                    criteria=options,
                ),
            },
        })
        answer = response.choices["next"]
        usage = getattr(response, "usage", None)  
        track_tokens(NAME, "jev-latest", getattr(usage, "input_tokens", 0) or 0)
        return {"next": answer.choice, "route_log": [f"{answer.choice}: jev confidence {answer.confidence:.2f}"]}

    return supervisor