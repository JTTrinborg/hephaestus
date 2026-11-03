from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from app.config import get_llm
from app.db import month_cost
from app.profile import load_profile
from app.registry import AgentSpec
from app.tools.registry import TOOLS
from app.db import get_setting, month_cost
from app.usage import track, track_tokens
from app.model_registry import get_model

############## THE FACTORY FILE THAT BUILDS AND RUNS THE AGENTS ###################

MAX_STEPS = 6


# Builds a working agent from one row in the registry
def build_agent(spec: AgentSpec):
    """Turn one row from the registry into a graph node"""
    if spec.kind == "decider":
        return build_decider(spec)
    tools = [TOOLS[name] for name in spec.tools]
    by_name = {tool.name: tool for tool in tools}
    llm = get_llm(spec.provider)
    if tools:
        llm = llm.bind_tools(tools)
    system = spec.system_prompt
# Adds the profile only if the agent asks for it and the platform setting allows this model
    model = get_model(spec.provider)
    local_only = get_setting("profile_local_only", "true") == "true"
    if spec.uses_profile and not (local_only and not (model and model.local)):
        profile, skills = load_profile()
        system += f"\n\n# My profile\n{profile}\n\n# My skills\n{skills}"

# Runs the agent on the task and returns its answer
    def run(state: dict) -> dict:
        earlier = "\n\n".join(f"# Result from {name}\n{text}" for name, text in state["results"].items())
        messages = [SystemMessage(content=system), HumanMessage(content=f"#Task\n{state['task']}\n\n{earlier}".strip())]
# Asks the model, runs the tools it wants and repeats until it answers
        for _ in range(MAX_STEPS):
            if spec.budget_usd is not None and month_cost(spec.name) >= spec.budget_usd:
                return {"results": {spec.name: f"Skipped. {spec.name} has used its monthly budget"}}
            response = llm.invoke(messages)
            track(spec.name, response)
            messages.append(response)
            if not response.tool_calls:
                return {"results": {spec.name: response.text}}
# Runs each tool the model asked for and gives it the result
            for call in response.tool_calls:
                result = by_name[call["name"]].invoke(call["args"])
                messages.append(ToolMessage(content=str(result), tool_call_id = call["id"]))
        return {"results": {spec.name: "Stopped after the step limit."}}
    return run



# Builds a decider, an agent that answers one typed question with Jev instead of writing text
def build_decider(spec: AgentSpec):
    from langchain_typesafe import Choice, Noul, Score, TypeSafeClassifier
    classifier = TypeSafeClassifier()

# Asks Jev the question about the task and the earlier results, and stores the answer
    def run(state: dict) -> dict:
        earlier = "\n\n".join(f"# Result from {name}\n{text}" for name, text in state["results"].items())
        state_text = f"Task: {state['task']}\n\n{earlier}".strip()
        if spec.question_type == "choice":
            question = Choice(instructions=spec.question, criteria=spec.options)
        elif spec.question_type == "score":
            question = Score(instructions=spec.question, levels=spec.options)
        else:
            question = Noul(instructions=spec.question)
        response = classifier.invoke({"state": state_text, "questions": {"answer": question}})
        usage = getattr(response, "usage", None)
        track_tokens(spec.name, "jev-latest", getattr(usage, "input_tokens", 0) or 0)
        return {"results": {spec.name: describe(spec.question_type, response)}}
    return run


# Turns Jev's typed answer into one short line the other agents can read
def describe(question_type: str, response) -> str:
    if question_type == "choice":
        a = response.choices["answer"]
        return f"{a.choice}, confidence {a.confidence:.2f}"
    if question_type == "score":
        a = response.scores["answer"]
        return f"score {a.score:.2f}, confidence {a.confidence:.2f}"
    p = response.nouls["answer"].noul
    return f"{'yes' if p >= 0.5 else 'no'}, probability {p:.2f}"