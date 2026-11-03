from typing import Literal
from pydantic import BaseModel, Field, model_validator
from app.db import _connect
from psycopg.types.json import Jsonb


####################### FILE FOR THE REGISTRY FOR THE AGENTS ###################################

# Describes one agent and checks that it is valid
class AgentSpec(BaseModel):
    name: str = Field(pattern=r"^[a-z][a-z0-9_]{1,30}$")
    description: str
    system_prompt: str
    provider: str
    tools: list[str] = []
    uses_profile: bool = False
    budget_usd: float | None = None
    active: bool = True
    kind: Literal["worker", "decider"] = "worker"
    question: str | None = None
    question_type: Literal["choice", "score", "noul"] | None = None
    options: dict[str, str] = {}

# Stops agents with names the platform needs for itself
    @model_validator(mode="after")
    def check_rules(self):
        if self.name == "supervisor":
            raise ValueError("supervisor is a reserved name")
        # A decider needs a question and uses Jev without tools
        if self.kind == "decider":
            if not self.question or not self.question_type:
                raise ValueError("A decider needs a question and a question_type")
            if self.provider != "jev" or self.tools:
                raise ValueError("A decider uses provider jev and no tools")
            if self.question_type in ("choice", "score") and len(self.options) < 2:
                raise ValueError("choice and score need at least two options")
        return self


# The columns in the agents table, in the same order everywhere
COLUMNS = "name, description, system_prompt, provider, tools, uses_profile, budget_usd, active, kind, question, question_type, options"
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
    values = spec.model_dump()
    values["options"] = Jsonb(spec.options)
    with _connect() as conn:
        conn.execute(
            f"INSERT INTO agents ({COLUMNS}) VALUES "
            "(%(name)s, %(description)s, %(system_prompt)s, %(provider)s, %(tools)s, "
            "%(uses_profile)s, %(budget_usd)s, %(active)s, "
            "%(kind)s, %(question)s, %(question_type)s, %(options)s) "
            "ON CONFLICT (name) DO UPDATE SET "
            "description = EXCLUDED.description, system_prompt = EXCLUDED.system_prompt, "
            "provider = EXCLUDED.provider, tools = EXCLUDED.tools, uses_profile = EXCLUDED.uses_profile, "
            "budget_usd = EXCLUDED.budget_usd, active = EXCLUDED.active, "
            "kind = EXCLUDED.kind, question = EXCLUDED.question, "
            "question_type = EXCLUDED.question_type, options = EXCLUDED.options, updated_at = now()",
            values,
        )
