import os
from dotenv import load_dotenv
load_dotenv()

####### CONFIG FILE THAT RETREIVES THE AI MODELS #######################
#For now it is hardcoded which models that is in the solution. Later this will be more dynamic

def get_llm(provider: str | None = None):
    provider = provider or os.getenv("MODEL_PROVIDER", "anthropic")
    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(model=os.getenv("OLLAMA_MODEL"), num_ctx=16384)
    from langchain_anthropic import ChatAnthropic
    return ChatAnthropic(model=os.getenv("ANTHROPIC_MODEL"))