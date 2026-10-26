from app.tools.jobs import recent_jobs
from app.tools.search import search_tool

###################### REGISTRY FILE FOR THE TOOLS THAT THE AGENTS CAN USE #############################


# The only tools an agent in  the registry can use
TOOLS = {
    "web_search": search_tool,
    "recent_jobs": recent_jobs,
}

