from pathlib import Path
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from app.config import get_llm
from app.tools.search import search_tool
from app.models import Job, JobList


#################### THIS IS THE MAIN FILE FOR THE AGENT NODE SETUP ###############################
#In this file we create the agents as well as set up the graph logic with langGraph and langChain.


################# SETUP ###########################
RANK = "rank"
RESEARCHER = "researcher"
TOOLS = "tools"
SYSTEM = SystemMessage(content="You are a professional researcher. Do web search when you need facts. State your sources with a link")
PROFILE = Path("data/profile.md").read_text(encoding="utf-8")


class JobState(TypedDict):
    alert_text: str
    jobs: list[Job]
    messages: Annotated[list[BaseMessage], add_messages]
    report: str


tools = [search_tool]
llm = get_llm("anthropic").bind_tools(tools)
rank_llm = get_llm("ollama").with_structured_output(JobList)




######## RANK NODE #####################
def rank(state: JobState) -> dict:
    prompt = (
        "Extract every job from the job alert below and score each one against my profile.\n\n"
        f"# My profile\n{PROFILE}\n\n# Job alert\n{state['alert_text']}"
    )
    result = rank_llm.invoke(prompt)
    jobs = sorted(result.jobs, key=lambda j: j.score, reverse=True)
    return {"jobs": jobs}


######## RESEARCHER NODE #####################
# Not connected in step 3, comes back in step 4
def researcher(state: JobState) -> dict:
    response = llm.invoke([SYSTEM] + state["messages"])
    return {"messages": [response]}




###### BUILDING THE GRAPH ##################
builder = StateGraph(JobState)
builder.add_node(RANK, rank)
builder.add_edge(START, RANK)
builder.add_edge(RANK, END)





# Step 4
# builder.add_node(RESEARCHER, researcher)
# builder.add_node(TOOLS, ToolNode(tools))
# builder.add_conditional_edges(RESEARCHER, tools_condition)
# builder.add_edge(TOOLS, RESEARCHER)

graph = builder.compile()


############# TEMPORARY STARTER FOR THE APP ########################
if __name__ == "__main__":
    alert = Path("data/sample_alert.txt").read_text(encoding="utf-8")
    result = graph.invoke({"alert_text": alert})
    for job in result["jobs"]:
        print(f"{job.score}/10  {job.title} · {job.company} · {job.location}")
        print(f"      {job.reason}\n")