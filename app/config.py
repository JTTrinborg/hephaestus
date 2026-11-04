import os
from langchain_anthropic import ChatAnthropic
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from dotenv import load_dotenv
load_dotenv()

####### CONFIG FILE THAT RETREIVES THE AI MODELS #######################
#For now it is hardcoded which models that is in the solution. Later this will be more dynamic

# Builds a chat model from a row in the model registry
def get_llm(name: str):
    from app.model_registry import get_model
    spec = get_model(name)
    if spec is None:
        raise ValueError(f"Unknown model: {name}")
    if spec.kind == "anthropic":
        return ChatAnthropic(model=spec.model)    # newer Claude models reject temperature
    if spec.kind == "ollama":
        return ChatOllama(
            model=spec.model,
            base_url=os.getenv("OLLAMA_URL", "http://127.0.0.1:11434"),
            temperature=0,
            reasoning=False,    # thinking off, rank went from 70 to about 10 seconds
        )
    return ChatOpenAI(
        model=spec.model,
        base_url=spec.base_url,
        api_key=os.getenv(spec.key_env or "") or "not-needed",
        temperature=0,
    )


PRICES = {
    "claude-haiku-5-5": (0.10, 0.50),
    "qwen3": (0.0, 0.0),
    "jev": (0.042, 0.0),
}

# Monthly limit in USD. None means no limit. As OLLAMA runs rank and report, it is not necessary to have a guard for them
BUDGETS = {
    "researcher": float(os.getenv("RESEARCHER_BUDGET_USD", "2.0")),
    "rank": None,
    "report": None,
}

# Price per million input and output tokens, from the registry or the old list
def price_for(model: str) -> tuple[float, float]:
    from app.model_registry import list_models
    for spec in list_models():
        if spec.model == model:
            return spec.price_in, spec.price_out
    return PRICES.get(model, (0.0, 0.0))