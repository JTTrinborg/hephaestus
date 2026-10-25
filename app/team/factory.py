from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from app.config import get_llm
from app.db import month_cost
from app.profile import PROFILE, SKILLS_TEXT
from app.registry import AgentSpec
from app.tools.registry import TOOLS
from app.usage import track

############## THE FACTORY FILE THAT BUILDS AND RUNS THE AGENTS ###################

MAX_STEPS = 6


# Builds a working agent from one row in the registry
def build_agent(spec: AgentSpec):
    """Turn one row from the registry into a graph node"""
    tools = [TOOLS[name] for name in spec.tools]
    by_name = {tool.name: tool for tool in tools}
    llm = get_llm(spec.provider)
    if tools:
        llm = llm.bind_tools(tools)

    system = spec.system_prompt
    if spec.uses_profile:
        system += f"\n\n# My profile\n{PROFILE}\n\n# My skills\n{SKILLS_TEXT}"

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