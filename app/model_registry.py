import os
from typing import Literal
from pydantic import BaseModel, Field, model_validator
from app.db import _connect


################## FILE FOR THE REGISTRY FOR THE AI MODELS ##########################


# Describes one AI model and checks that it is valid
class ModelSpec(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_-]{1,30}$")
    kind: Literal["anthropic", "ollama", "openai_compatible"]
    model: str
    base_url: str | None = None
    key_env: str | None = Field(default=None, pattern=r"^[A-Z][A-Z0-9_]*$")
    local: bool = False
    price_in: float = 0.0
    price_out: float = 0.0


# Stops models that cannot work, and names the platform needs for itself
@model_validator(mode="after")
def check_rules(self):
    if self.name == "jev":
        raise ValueError("Jev is reserved for the decision model")
    if self.kind == "openai_compatible" and not self.base_url:
        raise ValueError("openai_compatible models need a base_url")
    return self


# the models that work even without a database, for example in CI
BUILTIN = {
    "anthropic": ModelSpec(name="anthropic", kind="anthropic",
                        model=os.getenv("ANTHROPIC_MODEL", "claude-haiku-5-5"),
                        key_env="ANTHROPIC_API_KEY", price_in=0.10, price_out=0.50),
    "ollama": ModelSpec(name="ollama", kind="ollama",
                        model=os.getenv("OLLAMA_MODEL", "qwen3:14b"), local=True),
}

COLUMNS = "name, kind, model, base_url, key_env, local, price_in, price_out"


# Gets all models from the registry, or the built in ones if there is no database
def list_models() -> list[ModelSpec]:
    try:
        with _connect() as conn:
            rows = conn.execute(f"SELECT {COLUMNS} FROM models ORDER BY name").fetchall()
        return [ModelSpec(**dict(zip(COLUMNS.split(", "), row))) for row in rows] or list(BUILTIN.values())
    except Exception:
        return list(BUILTIN.values())



# Gets one model by name, or None if it does not exist
def get_model(name: str) -> ModelSpec | None:
    return next((m for m in list_models() if m.name == name), None)


# Saves a model, new or changed
def upsert_model(spec: ModelSpec) -> None:
    with _connect() as conn:
        conn.execute(
            f"INSERT INTO models ({COLUMNS}) VALUES "
            "(%(name)s, %(kind)s, %(model)s, %(base_url)s, %(key_env)s, %(local)s, %(price_in)s, %(price_out)s) "
            "ON CONFLICT (name) DO UPDATE SET kind = EXCLUDED.kind, model = EXCLUDED.model, "
            "base_url = EXCLUDED.base_url, key_env = EXCLUDED.key_env, local = EXCLUDED.local, "
            "price_in = EXCLUDED.price_in, price_out = EXCLUDED.price_out",
            spec.model_dump(),
        )



# Copies the built-in models into the database once
if __name__ == "__main__":
    for spec in BUILTIN.values():
        upsert_model(spec)
        print(f"seeded {spec.name}")