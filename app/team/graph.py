from langgraph.graph import END, START, StateGraph
from app.registry import list_agents
from app.team.factory import build_agent
from app.team.state import TeamState
from app.team.supervisor import build_supervisor

################# GRAPH FILE FOR THE AGENT TEAM. THIS IS SEPARATE FROM THE MORNING JOB #################


RECURSION_LIMIT = 12

# Builds the team graph from the active agents
def build_team(specs=None):
    specs = specs or list_agents()
    builder = StateGraph(TeamState)
    builder.add_node("supervisor", build_supervisor(specs))
# Adds each agent as a node that reports back to the supervisor
    for spec in specs:
        builder.add_node(spec.name, build_agent(spec))
        builder.add_edge(spec.name, "supervisor")
    builder.add_edge(START, "supervisor")
    routes = {spec.name: spec.name for spec in specs} | {"FINISH": END}
    builder.add_conditional_edges("supervisor", lambda state: state["next"], routes)
    return builder.compile()


# Runs one task through the team
def run_task(task: str, config: dict | None = None) -> dict:
    start = {"task": task, "results": {}, "next": "", "route_log": []}
    return build_team().invoke(start, config={**(config or {}), "recursion_limit": RECURSION_LIMIT})



# Picks the answer from the agent that worked last
def final_answer(result: dict) -> str:
    """The result from the last agent that worked."""
    worked = [line.split(":")[0] for line in result["route_log"] if not line.startswith("FINISH")]
    return result["results"][worked[-1]] if worked else "Nothing to do."



# Runs one task and yelds each step as it finishes, for live progress
def stream_task(task: str, config: dict | None = None):
    start = {"task": task, "results": {}, "next":"", "route_log": []}
    config = {**(config or {}), "recursion_limit": RECURSION_LIMIT}
    yield from build_team().stream(start, config=config, stream_mode="updates")




# Runs the team on a test task when the file is started directly
if __name__ == "__main__":
    from langfuse import get_client
    from app.tracing import trace_config

    try:
        result = run_task(
            "Find my three best jobs and write a draft for the best one",
            trace_config("team-test", ["team", "test"]),
        )
        print("\n".join(result["route_log"]))
        print("\n" + final_answer(result))
    finally:
        get_client().flush()