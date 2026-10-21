from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from app.budget import BudgetExceeded, check_budget
from app.config import get_llm
from app.tools.jobs import recent_jobs
from app.tools.search import search_tool
from app.usage import track

################## FILE FOR THE RESEARCHER AGENT #########################

NAME = "researcher"
TOOLS = {t.name: t for t in [search_tool, recent_jobs]}
MAX_STEPS = 6
SYSTEM = SystemMessage(content=(
    "You are a job researcher. Use recent_jobs to find jobs I have received, "
    "and web search for facts about companies. Answer short, and include job links."
))
llm = get_llm("anthropic").bind_tools(list(TOOLS.values()))

# What the research agent should do. Also stores the convo so that the agent remembers what it said. Also checks if the agent is needing a tool
def _research(task: str) -> str:
    messages = [SYSTEM, HumanMessage(content=task)]
    for _ in range(MAX_STEPS):
        check_budget(NAME)
        response = llm.invoke(messages)
        track(NAME, response)
        messages.append(response)
        if not response.tool_calls:
            return response.text
        for call in response.tool_calls:
            result = TOOLS[call["name"]].invoke(call["args"])
            messages.append(ToolMessage(content=str(result), tool_call_id=call["id"]))
    return "Research stopped after the step limit"


def researcher(state: dict) -> dict:
    try:
        return {"research": _research(state["task"])}
    except BudgetExceeded as e:
        return {"research": f"Research skipped. {e}"}