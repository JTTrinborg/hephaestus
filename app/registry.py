from typing import Literal
from pydantic import BaseModel, Field, model_validator
from app.db import _connect


####################### FILE FOR THE REGISTRY FOR THE AGENTS ###################################

# Describes one agent and checks that it is valid
class AgentSpec(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]{1,30}$")
    description: str
    system_prompt: str
    provider: Literal["ollama", "anthropic"]
    tools: list[str] = []
    uses_profile: bool = False
    budget_usd: float | None = None
    active: bool = True

# Stops agents with names the platform needs for itself
    @model_validator(mode="after")
    def check_rules(self):
        if self.name == "supervisor":
            raise ValueError("Supervisor is a reserved name")
        return self



COLUMNS = "name, description, system_prompt, provider, tools, uses_profile, budget_usd, active"
# Turns one database row into an AgentSpec
def _to_spec(row) -> AgentSpec:
    return AgentSpec(**dict(zip(COLUMNS.split(", "), row)))


# Gets the agents from the registry, only active ones by default
def list_agents(active_only: bool = True) -> list[AgentSpec]:
    sql = f"SELECT {COLUMNS} FROM agents" + (" WHERE active" if active_only else "") + " ORDER BY name"
    with _connect() as conn:
        return [_to_spec(row) for row in conn.execute(sql).fetchall()]


# Saves an agent, new or changed
def upsert_agent(spec: AgentSpec) -> None:
    """Creates the agent, or update it if the name exist"""
    values = spec.model_dump()
    with _connect() as conn:
        conn.execute(
            f"INSERT INTO agents ({COLUMNS}) VALUES "
            "(%(name)s, %(description)s, %(system_prompt)s, %(provider)s, %(tools)s, "
            "%(uses_profile)s, %(budget_usd)s, %(active)s) "
            "ON CONFLICT (name) DO UPDATE SET "
            "description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt, "
            "provider = EXCLUDED.provider, tools = EXCLUDED.tools, uses_profile = EXCLUDED.uses_profile, "
            "budget_usd = EXCLUDED.budget_usd, active = EXCLUDED.active, updated_at = now()",
            values,
        )