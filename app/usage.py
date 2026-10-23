from app.config import price_for
from app.db import log_usage
import os

########## FILE TO STORE USAGE OF TOKENS AND COST FOR THE MODELS  ###############


def track(agent: str, message) -> None:
    """Store tokens and cost for one model response."""
    if not os.getenv("DATABASE_URL"):
        return # Makes it possible to run even tho there are no DB. This is needed for the CI pipeline
    usage = message.usage_metadata or {}
    meta = message.response_metadata or {}
    model = meta.get("model_name") or meta.get("model") or "unknown"
    tokens_in = usage.get("input_tokens", 0)
    tokens_out = usage.get("output_tokens", 0)
    price_in, price_out = price_for(model)
    cost = (tokens_in * price_in + tokens_out * price_out) / 1_000_000
    log_usage(agent, model, tokens_in, tokens_out, cost)
