import os
from dotenv import load_dotenv
load_dotenv()

####### CONFIG FILE THAT RETREIVES THE AI MODELS #######################
#For now it is hardcoded which models that is in the solution. Later this will be more dynamic

def get_llm(provider: str | None = None):
    provider = provider or os.getenv("MODEL_PROVIDER", "anthropic")
    if provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=os.getenv("OLLAMA_MODEL"),
            base_url=os.getenv("OLLAMA_HOST", "http://localhost:11434"),
            num_ctx=16384,
            reasoning=False,
        )
    from langchain_anthropic import ChatAnthropic
    return ChatAnthropic(model=os.getenv("ANTHROPIC_MODEL"))


PRICES = {
    "claude-haiku-5-5": (0.10, 0.50),
    "qwen3": (0.0, 0.0),
}

def price_for(model: str) -> tuple[float, float]:
    for name, price in PRICES.items():
        if model.startswith(name):
            return price
    return (0.0, 0.0)