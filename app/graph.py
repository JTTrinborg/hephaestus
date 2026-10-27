import time
T0 = time.time() # For troubleshooting
def t(label): print(f"[{time.time() - T0:6.1f}s] {label}") # For troubleshooting
from pathlib import Path
from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from langfuse import get_client
from app.tracing import trace_config
from app.config import get_llm
from app.tools.search import search_tool
from app.db import filter_new, mark_sent, cost_summary
from app.budget import BudgetExceeded, check_budget
from app.usage import track
from app.profile import load_profile
from app.models import Job, JobInfo
from app.tools.alerts import split_alert
t("imports done") # For troubleshooting


#################### THIS IS THE MAIN FILE FOR THE AGENT NODE SETUP ###############################
#In this file we create the agents as well as set up the graph logic with langGraph and langChain.


################# SETUP ###########################
RANK = "rank"
RESEARCHER = "researcher"
TOOLS = "tools"
DEDUPE = "dedupe"
REPORT = "report"
SYSTEM = SystemMessage(content="You are an expert job researcher. Give me the answer short and consice. Write like a caveman")
tools = [search_tool]
llm = get_llm("anthropic").bind_tools(tools)
report_llm = get_llm("ollama")
rank_llm = get_llm("ollama").with_structured_output(JobInfo, include_raw=True)




class JobState(TypedDict):
    alert_text: str
    jobs: list[Job]
    messages: Annotated[list[BaseMessage], add_messages]
    report: str




######## RANK NODE #####################
# Scores every job in the alert against my profile, and lets code copy the exact lines
def rank(state: JobState) -> dict:
    start = time.time()  # For troubleshooting
    profile, skills = load_profile()
    jobs = []
    for chunk in split_alert(state["alert_text"]):
        lines = [l.strip() for l in chunk["text"].splitlines() if l.strip() and l.strip() != "logo"][-15:]
        numbered = "\n".join(f"{i}: {line}" for i, line in enumerate(lines))
        prompt = (
            "Score one job against my profile.\n\n"
            f"# My profile\n{profile}\n\n# My skills\n{skills}\n\n"
            "# Numbered lines before the job link\n"
            "The last job in these lines belongs to the link. "
            "Give the line numbers of its title, company and location. "
            "Email subjects and introductions are never the title.\n\n"
            f"{numbered}"
        )
        result = rank_llm.invoke(prompt)
        track(RANK, result["raw"])
        info = result["parsed"]
        # Gets the line the model pointed at, or a placeholder if the number is wrong
        def pick(i: int) -> str:
            return lines[i] if info and 0 <= i < len(lines) else "(could not read)"
        if info is None:
            jobs.append(Job(title="(could not read)", company="", location="", url=chunk["url"],
                            score=1, reason="Model output could not be parsed"))
            continue
        jobs.append(Job(title=pick(info.title_line), company=pick(info.company_line),
                        location=pick(info.location_line), url=chunk["url"],
                        score=info.score, reason=info.reason))
    print(f"rank took {time.time() - start:.1f}s")  # For troubleshooting
    return {"jobs": sorted(jobs, key=lambda j: j.score, reverse=True)}


######## RESEARCHER NODE #####################
def researcher(state: JobState) -> dict:
    messages = state["messages"]
    new_messages = []
# Checks first if it is over budget
    try:
        check_budget(RESEARCHER)
    except BudgetExceeded as e:
        return {"messages": [AIMessage(content=f"Company research skipped. {e}")]}

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
    track(RESEARCHER, response)
    return {"messages": new_messages + [response]}


######## DEDUPE NODE #####################
def dedupe(state: JobState) -> dict:
    t("dedupe start")  
    new_jobs = filter_new(state["jobs"])
    print(f"{len(state['jobs'])} jobs found, {len(new_jobs)} new")
    t("dedupe done") # For troubleshooting
    return {"jobs": new_jobs}


######## REPORT NODE #####################
def report(state:JobState) -> dict:
    jobs = state["jobs"]
    if not jobs:
        return {"report": "No new jobs today bretherin."}

    job_lines = "\n".join(
        f"- {j.score}/10 {j.title} at {j.company} ({j.location}) {j.url}\n  {j.reason}"
        for j in jobs
    )
    research = state["messages"][-1].text if state["messages"] else ""

    prompt = (
        "Write a short job report email in markdown.\n"
        "Use exactly this format for each of the top 5 jobs. Never use tables.\n\n"
        "### {score}/10 {title} at {company}\n"
        "- **Location:** {location}\n"
        "- **Link:** [Job listing]({url})\n"
        "- **Reason:** {reason}\n"
        "- **Company:** one or two lines from the research\n\n"
        "Then a section '## Remaining jobs' with one line per job: score, title, company, link.\n"
        "Do not invent anything. Only use the information below.\n"
        "Return the markdown directly. Do not wrap it in a code block.\n\n"
        f"# Jobs\n{job_lines}\n\n# Company research\n{research}"
    )
    response = report_llm.invoke(prompt)
    track(REPORT, response)
    text = response.text
    if research.startswith("Company research skipped"):
        text = f"> ⚠️ {research}\n\n{text}"
    text = text + "\n\n" + cost_summary()
    mark_sent(jobs)
    return {"report": text}


######## Conditional IF NEW JOBS NODE ##################
def has_new_jobs(state: JobState) -> str:
    return RESEARCHER if state["jobs"] else REPORT




###### BUILDING THE GRAPH ##################
builder = StateGraph(JobState)
builder.add_node(RANK, rank)
builder.add_node(DEDUPE, dedupe)
builder.add_node(RESEARCHER, researcher)
builder.add_node(REPORT, report)
builder.add_node(TOOLS, ToolNode(tools))

builder.add_edge(START, RANK)
builder.add_edge(RANK, DEDUPE)
builder.add_conditional_edges(DEDUPE, has_new_jobs,
                              {
                                  RESEARCHER: RESEARCHER,
                                  REPORT: REPORT
                              })
builder.add_conditional_edges(RESEARCHER, tools_condition,
                              {
                                  TOOLS: TOOLS,
                                  END: REPORT
                              })
builder.add_edge(TOOLS, RESEARCHER)
builder.add_edge(REPORT, END)

graph = builder.compile()
t("graph compiled") # For troubleshooting


############# TEMPORARY STARTER FOR THE APP ########################
if __name__ == "__main__":
    alert = Path("data/sample_alert.txt").read_text(encoding="utf-8")
    result = graph.invoke({"alert_text": alert}, config=trace_config("local-test", ["test"]))
    for job in result["jobs"]:
        print(f"{job.score}/10  {job.title} · {job.company} · {job.location}")
        print(f"      {job.reason}\n")
    print(result["report"])
    get_client().flush() # always send the trace, also when the run fails
    t("finished")  # For troubleshooting