import asyncio
import logging
import sys
from concurrent.futures import ThreadPoolExecutor
from langchain_core.tools import StructuredTool
from langchain_mcp_adapters.client import MultiServerMCPClient
from app.guards import guard_tool_output


######## MCP SERVERS THE AGENTS MAY USE. A NEW SERVER IS A CODE CHANGE, NOT A DATABASE ROW ########
log = logging.getLogger("hephaestus.mcp")
SERVERS = {
    "fetch": {"command": sys.executable, "args": ["-m", "mcp_server_fetch"], "transport": "stdio"},
}
# Servers whose output comes from outside and must pass the tool guard
UNTRUSTED = {"fetch"}


# Runs async code from sync code, also when an event loop is already running, as in uvicorn
def run_sync(coro):
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with ThreadPoolExecutor(1) as pool:
        return pool.submit(asyncio.run, coro).result()


# Turns the content blocks an MCP tool returns into plain text
def as_text(result) -> str:
    if isinstance(result, list):
        return "\n".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in result)
    return str(result)


# Wraps an async MCP tool as a normal tool the factory can call, with the guard on its output
def wrap(tool, server: str) -> StructuredTool:
    name = f"mcp_{tool.name}"

# Calls the MCP tool and guards the answer when it comes from outside
    def run(**kwargs) -> str:
        text = as_text(run_sync(tool.ainvoke(kwargs)))
        return guard_tool_output(name, text) if server in UNTRUSTED else text

    return StructuredTool.from_function(
        func=run, name=name, description=tool.description, args_schema=tool.args_schema
    )


# Loads the tools from every MCP server, and skips a server that does not start
def load_mcp_tools() -> dict:
    tools = {}
    for server, connection in SERVERS.items():
        try:
            found = run_sync(MultiServerMCPClient({server: connection}).get_tools())
        except Exception as e:
            log.warning("MCP server %s not loaded: %r", server, e)
            continue
        for tool in found:
            wrapped = wrap(tool, server)
            tools[wrapped.name] = wrapped
    return tools