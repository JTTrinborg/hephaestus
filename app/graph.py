import time
T0 = time.time() # For troubleshooting
def t(label): print(f"[{time.time() - T0:6.1f}s] {label}") # For troubleshooting
from pathlib import Path
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from app.config import get_llm
from app.tools.search import search_tool
from app.models import Job, JobList
from app.db import filter_new
t("imports done") # For troubleshooting


#################### THIS IS THE MAIN FILE FOR THE AGENT NODE SETUP ###############################
#In this file we create the agents as well as set up the graph logic with langGraph and langChain.


################# SETUP ###########################
RANK = "rank"
RESEARCHER = "researcher"
TOOLS = "tools"
DEDUPE = "dedupe"
SYSTEM = SystemMessage(content="You are an expert job researcher. Give me the answer short and consice. Write like a caveman")
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
    start = time.time() # For troubleshooting
    prompt = (
        "Extract every job from the job alert below and score each one against my profile.\n\n"
        f"# My profile\n{PROFILE}\n\n# Job alert\n{state['alert_text']}"
    )
    result = rank_llm.invoke(prompt)
    jobs = sorted(result.jobs, key=lambda j: j.score, reverse=True)
    print(f"rank took {time.time() - start:.1f}s") # For troubleshooting
    return {"jobs": jobs}


######## RESEARCHER NODE #####################
# Not connected in step 3, comes back in step 4
def researcher(state: JobState) -> dict:
    messages = state["messages"]
    new_messages = []

    if not messages:
        top5 = state["jobs"][:5]
        job_list = "\n".join(
            f"- {j.title} at {j.company} ({j.location}) {j.url}" for j in top5
        )
        task = HumanMessage(content=(
            "Find short facts about each company below. What they do, roughly how big they are, "
            "and whether they have an office in Brisbane or Gold Coast. "
            "One short paragraph per company, with source links.\n\n" + job_list
        ))
        messages = [task]
        new_messages = [task]

    response = llm.invoke([SYSTEM] + messages)
    return {"messages": new_messages + [response]}


######## DEDUPE NODE #####################
def dedupe(state: JobState) -> dict:
    t("dedupe start")  
    new_jobs = filter_new(state["jobs"])
    print(f"{len(state['jobs'])} jobs found, {len(new_jobs)} new")
    t("dedupe done") # For troubleshooting
    return {"jobs": new_jobs}





###### BUILDING THE GRAPH ##################
builder = StateGraph(JobState)
builder.add_node(RANK, rank)
builder.add_node(DEDUPE, dedupe)
builder.add_node(RESEARCHER, researcher)
builder.add_edge(START, RANK)
builder.add_edge(RANK, DEDUPE)
builder.add_edge(DEDUPE, RESEARCHER)
builder.add_edge(RESEARCHER, END)
builder.add_node(TOOLS, ToolNode(tools))
builder.add_conditional_edges(RESEARCHER, tools_condition)
builder.add_edge(TOOLS, RESEARCHER)

graph = builder.compile()
t("graph compiled") # For troubleshooting


############# TEMPORARY STARTER FOR THE APP ########################
if __name__ == "__main__":
    alert = Path("data/sample_alert.txt").read_text(encoding="utf-8")
    result = graph.invoke({"alert_text": alert})
    for job in result["jobs"]:
        print(f"{job.score}/10  {job.title} · {job.company} · {job.location}")
        print(f"      {job.reason}\n")
    t("finished")  # For troubleshooting