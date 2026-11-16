from app.tools.jobs import recent_jobs
from app.tools.mcp_tools import load_mcp_tools
from app.tools.search import search_tool

###################### REGISTRY FILE FOR THE TOOLS THAT THE AGENTS CAN USE #############################


# The only tools an agent in  the registry can use, the built in ones and those from MCP servers in the code
TOOLS = {
    "web_search": search_tool,
    "recent_jobs": recent_jobs,
}
TOOLS.update(load_mcp_tools())
