from typing import Annotated, TypedDict
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from app.config import get_llm
from app.tools.search import search_tool


#################### THIS IS THE MAIN FILE FOR THE AGENT NODE SETUP ###############################
#In this file we create the agents as well as set up the graph logic with langGraph and langChain.


################# SETUP ###########################
RESEARCHER = "researcher"
TOOLS = "tools"
SYSTEM = SystemMessage(content="You are a professional researcher. Do web search when you need facts. State your sources with a link")



class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


tools = [search_tool]
llm = get_llm("ollama").bind_tools(tools)





######## RESEARCHER NODE #####################
def researcher(state:AgentState) -> dict:
    response = llm.invoke([SYSTEM] + state["messages"])
    return {"messages": [response]}






###### BUILDING THE GRAPH ##################
builder = StateGraph(AgentState)
builder.add_node(RESEARCHER, researcher)
builder.add_node(TOOLS, ToolNode(tools))
builder.add_edge(START, RESEARCHER)
builder.add_conditional_edges(RESEARCHER, tools_condition)
builder.add_edge(TOOLS, RESEARCHER)
graph = builder.compile()




############# TEMPORARY STARTER FOR THE APP ########################
if __name__ == "__main__":
    question = input("Hail brother! What is your question today?\n")
    result = graph.invoke({"messages": [HumanMessage(content=question)]})
    print(result["messages"][-1].text)