from langfuse.langchain import CallbackHandler

########## THIS FILE IS FOR THE LANGFUSE TRACING ##################

def trace_config(run_name: str, tags: list[str] | None = None) -> dict:
    """Config for graph.invoke that sends the run to Langfuse."""
    return {
        "callbacks": [CallbackHandler()],
        "run_name": run_name,
        "metadata": {"langfuse_tags": tags or []},
    }