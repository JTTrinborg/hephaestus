from langgraph.graph import END, START, StateGraph
from app.team.researcher import researcher
from app.team.state import TeamState
from app.team.supervisor import supervisor
from app.team.writer import writer


################# GRAPH FILE FOR THE AGENT TEAM. THIS IS SEPARATE FROM THE MORNING JOB #################


RECURSION_LIMIT = 12

builder = StateGraph(TeamState)
builder.add_node("supervisor", supervisor)
builder.add_node("researcher", researcher) 
builder.add_node("writer", writer)

builder.add_edge(START, 'supervisor')
builder.add_conditional_edges(
    "supervisor",
    lambda state: state["next"],
    {"researcher": "researcher", 
    "writer": "writer", 
    "FINISH": END}
)
builder.add_edge("researcher", "supervisor")
builder.add_edge("writer", "supervisor")

team = builder.compile()



def run_task(task: str, config: dict | None = None) -> dict:
    start = {"task": task, "research": "", "draft": "", "next": "", "route_log": []}
    return team.invoke(start, config={**(config or {}), "recursion_limit": RECURSION_LIMIT})




if __name__ == "__main__":
    from langfuse import get_client
    from app.tracing import trace_config

    try:
        result = run_task(
            "Find my three best jobs and write a draft for the best one",
            trace_config("team-test", ["team", "test"]),
        )
        print("\n".join(result["route_log"]))
        print("\n" + (result["draft"] or result["research"]))
    finally:
        get_client().flush()