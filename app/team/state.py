import operator
from typing import Annotated, TypedDict

################ A file to hold the state of the agents ###################
# It is a way to share info among the agents

# Adds new results without removing the old ones
def merge(old: dict, new: dict) -> dict:
    return {**old, **new}


# Everything the team shares while it works on a task
class TeamState(TypedDict):
    task: str
    result: Annotated[dict[str, str], merge]
    next: str
    route_log: Annotated[list[str],operator.add]