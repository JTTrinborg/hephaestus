import re
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
from app.db import filter_new, save_jobs, cost_summary
from app.budget import BudgetExceeded, check_budget
from app.usage import track
from app.profile import load_profile
from app.models import CompanyFacts, CompanyList, Job, JobInfo
from app.tools.alerts import split_alert
from app.guards import UNTRUSTED_NOTE
t("imports done") # For troubleshooting


#################### THIS IS THE MAIN FILE FOR THE AGENT NODE SETUP ###############################
#In this file we create the agents as well as set up the graph logic with langGraph and langChain.


################# SETUP ###########################
RANK = "rank"
RESEARCHER = "researcher"
TOOLS = "tools"
FACTS = "facts"
DEDUPE = "dedupe"
REPORT = "report"
TOP = 5
SYSTEM = SystemMessage(content="You are an expert job researcher. Give me the answer short and consice. Write like a caveman" + UNTRUSTED_NOTE)
tools = [search_tool]
llm = get_llm("anthropic").bind_tools(tools)
facts_llm = get_llm("anthropic").with_structured_output(CompanyList, include_raw=True)
rank_llm = get_llm("ollama").with_structured_output(JobInfo, include_raw=True)

# How the score is meant, used in the rank prompt and in the report
SCALE = (
    "1-3 the role is unlikely to fit, skip it\n"
    "4-6 unlikely, but worth a try\n"
    "7-8 a real chance, apply\n"
    "9 a very good match and a good chance, definitely apply\n"
    "10 a dream match, apply now"
)
VERDICTS = [
    (3, "Dropp, usannsynlig"),
    (6, "Usannsynlig, men kan prøve"),
    (8, "Mulig, så søk!"),
    (9, "Veldig bra match, burde absolutt søke"),
    (10, "Drømmetreff! Søk!!"),
]


class JobState(TypedDict):
    alert_text: str
    jobs: list[Job]
    messages: Annotated[list[BaseMessage], add_messages]
    companies: dict[str, CompanyFacts]
    report: str




######## RANK NODE #####################
# Reads remote, hybrid or on-site from the alert lines in code, so the model cannot guess it
def work_mode_of(lines: list[str]) -> str:
    text = " ".join(lines).lower()
    if "hybrid" in text:
        return "hybrid"
    if re.search(r"\b(remote|work from home|wfh)\b", text):
        return "remote"
    if re.search(r"\b(on-site|onsite|on site)\b", text):
        return "on-site"
    return "unknown"


# Shortens a skill name from the profile, so 'AWS (EC2, S3)' becomes 'AWS'
def short(skill: str) -> str:
    return re.sub(r"\s*\(.*?\)", "", skill).strip()



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
            f"# Score scale\n{SCALE}\n\n"
            "# Numbered lines before the job link\n"
            "The last job in these lines belongs to the link. "
            "Give the line numbers of its title, company and location, and of the salary or -1 if there is none. "
            "Email subjects and introductions are never the title. "
            "Matching skills must be skills from my list rated 7 or higher. "
            "Missing skills are what the job needs that I rate 5 or lower or do not have. "
            "Only use what the lines and the title say about the job. "
            "The reason is one short sentence.\n\n"
            f"{numbered}"
        )
        result = rank_llm.invoke(prompt)
        track(RANK, result["raw"])
        info = result["parsed"]
        # Gets the line the model pointed at, or a placeholder if the number is wrong
        def pick(i: int, missing: str = "(could not read)") -> str:
            return lines[i] if info and 0 <= i < len(lines) else missing
        if info is None:
            jobs.append(Job(title="(could not read)", company="", location="", url=chunk["url"],
                            score=1, reason="Model output could not be parsed"))
            continue
        salary = pick(info.salary_line, "")
        jobs.append(Job(title=pick(info.title_line), company=pick(info.company_line),
                        location=pick(info.location_line), url=chunk["url"],
                        score=info.score, reason=info.reason, work_mode=work_mode_of(lines),
                        salary=salary if re.search(r"\d", salary) else "",
                        matching_skills=[short(s) for s in info.matching_skills[:3]],
                        missing_skills=[short(s) for s in info.missing_skills[:3]]))
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
        top = state["jobs"][:TOP]
        job_list = "\n".join(
            f"- {j.title} at {j.company} ({j.location}) {j.url}" for j in top
        )
        task = HumanMessage(content=(
            "For each company below, find what they do, how many employees they have, "
            "the year they were founded, and the typical salary range in AUD for the role "
            "in Brisbane or Gold Coast. Say unknown when you cannot find it. "
            "One short paragraph per company, with source links.\n\n" + job_list
        ))
        messages = [task]
        new_messages = [task]

    response = llm.invoke([SYSTEM] + messages)
    track(RESEARCHER, response)
    return {"messages": new_messages + [response]}


######## FACTS NODE #####################
# Turns the research text into facts per company, so the report can be built in code
def facts(state: JobState) -> dict:
    research = state["messages"][-1].text if state["messages"] else ""
    if not research or research.startswith("Company research skipped"):
        return {"companies": {}}
    names = "\n".join(f"- {j.company}" for j in state["jobs"][:TOP])
    result = facts_llm.invoke(
        "Pull out facts for each company in the list. Use only the research below. "
        f"Use 'unknown' when the research does not say.\n\n# Companies\n{names}\n\n# Research\n{research}"
    )
    track(FACTS, result["raw"])
    found = result["parsed"].companies if result["parsed"] else []
    return {"companies": {c.company.lower(): c for c in found}}


######## DEDUPE NODE #####################
def dedupe(state: JobState) -> dict:
    t("dedupe start")
    new_jobs = filter_new(state["jobs"])
    print(f"{len(state['jobs'])} jobs found, {len(new_jobs)} new")
    t("dedupe done") # For troubleshooting
    return {"jobs": new_jobs}


######## REPORT NODE #####################
# Turns a score into what I should do about the job
def verdict(score: int) -> str:
    return next(text for top, text in VERDICTS if score <= top)


# True when a fact was found, also when the model wrote 'unknown' with a note after it
def known(value: str) -> bool:
    return bool(value) and not value.strip().lower().startswith("unknown")


# Writes the full block for one of the top jobs, in code so nothing is changed or invented
def job_block(job: Job, company: CompanyFacts | None) -> str:
    where = job.location if job.work_mode == "unknown" else f"{job.location}, {job.work_mode}"
    if company:
        size = ", ".join(p for p in [
            f"{company.employees} ansatte" if known(company.employees) else "",
            f"grunnlagt {company.founded}" if known(company.founded) else "",
        ] if p) or "ukjent størrelse"
        about = f"{company.what_they_do} ({size})"
    else:
        about = "Ingen research"
    if job.salary:
        salary = f"{job.salary} (fra annonsen)"
    elif company and known(company.salary_estimate):
        salary = f"{company.salary_estimate} (estimat)"
    else:
        salary = "Ukjent"
    return (
        f"### {job.score}/10 {job.title}\n"
        f"**{verdict(job.score)}**\n\n"
        f"- **Selskap:** {job.company}. {about}\n"
        f"- **Hvor:** {where}\n"
        f"- **Matchende skills:** {', '.join(job.matching_skills) or 'Ingen funnet'}\n"
        f"- **Manglende skills:** {', '.join(job.missing_skills) or 'Ingen funnet'}\n"
        f"- **Lønn:** {salary}\n"
        f"- **Hvorfor:** {job.reason}\n"
        f"- [Se annonsen]({job.url})\n"
    )


# Builds the report email in code from the ranked jobs and the company facts
def report(state: JobState) -> dict:
    jobs = state["jobs"]
    if not jobs:
        return {"report": "No new jobs today bretherin."}
    companies = state.get("companies") or {}
    blocks = [job_block(j, companies.get(j.company.lower())) for j in jobs[:TOP]]
    rest = [f"- {j.score}/10 [{j.title}]({j.url}) hos {j.company}. {verdict(j.score)}" for j in jobs[TOP:]]
    text = "\n".join(blocks)
    if rest:
        text += "\n## Resten\n" + "\n".join(rest)
    research = state["messages"][-1].text if state["messages"] else ""
    if research.startswith("Company research skipped"):
        text = f"> ⚠️ {research}\n\n{text}"
    text = text + "\n\n" + cost_summary()
    save_jobs(jobs)
    return {"report": text}


######## Conditional IF NEW JOBS NODE ##################
def has_new_jobs(state: JobState) -> str:
    return RESEARCHER if state["jobs"] else REPORT




###### BUILDING THE GRAPH ##################
builder = StateGraph(JobState)
builder.add_node(RANK, rank)
builder.add_node(DEDUPE, dedupe)
builder.add_node(RESEARCHER, researcher)
builder.add_node(FACTS, facts)
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
                                  END: FACTS
                              })
builder.add_edge(TOOLS, RESEARCHER)
builder.add_edge(FACTS, REPORT)
builder.add_edge(REPORT, END)

graph = builder.compile()
t("graph compiled") # For troubleshooting


############# TEMPORARY STARTER FOR THE APP ########################
if __name__ == "__main__":
    alert = Path("data/sample_alert.txt").read_text(encoding="utf-8")
    result = graph.invoke({"alert_text": alert}, config=trace_config("local-test", ["test"]))
    for job in result["jobs"]:
        print(f"{job.score}/10  {job.title} · {job.company} · {job.location} · {job.work_mode}")
        print(f"      + {', '.join(job.matching_skills)}  - {', '.join(job.missing_skills)}")
        print(f"      {job.reason}\n")
    print(result["report"])
    get_client().flush() # always send the trace, also when the run fails