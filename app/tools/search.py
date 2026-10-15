from langchain_tavily import TavilySearch

########## THIS FILE IS FOR THE SEARCH TOOL ############################
#It lets the agents call Tavily, which is a search engine for AI, to do web searches

search_tool = TavilySearch(max_results=5)