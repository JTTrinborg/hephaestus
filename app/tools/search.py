from langchain_core.tools import tool
from langchain_tavily import TavilySearch
from app.guards import guard_tool_output

########## THIS FILE IS FOR THE SEARCH TOOL ############################
#It lets the agents call Tavily, which is a search engine for AI, to do web searches

_tavily = TavilySearch(max_results=5)



# Searches the web with Tavily and passes the result through the tool guard
@tool("web_search")
def search_tool(query: str) -> str:
    """Search the web. Returns titles, links and short extracts from each page."""
    return guard_tool_output("web_search", str(_tavily.invoke({"query": query})))