from typing import Annotated, TypedDict
from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
load_dotenv()
from app.tools.search import search_tool



################# SETUP ###########################
RESEARCHER = "researcher"
TOOLS = "tools"
SYSTEM = SystemMessage(content="You are a professional researcher. Do web search when you need facts. State your sources")



class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


tools = [search_tool]
llm = ChatAnthropic(model="claude-haiku-5-5").bind_tools(tools)





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