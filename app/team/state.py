import operator
from typing import Annotated, TypedDict

################ A file to hold the state of the agents ###################

class TeamState(TypedDict):
    task: str
    research: str
    draft: str
    next: str
    route_log: Annotated[list[str],operator.add]