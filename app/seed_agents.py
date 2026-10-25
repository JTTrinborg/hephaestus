from app.registry import AgentSpec, upsert_agent

####################### FILE FOR FILLING THE DB WITH START DATA FOR THE AGENTS #####################



# The agents Hephaestus starts with
SEED_AGENTS = [
# AGENT 1: RESEARCHER
    AgentSpec(
        name="researcher",
        description=(
            "Answers questions about my jobs and about companies. "
            "Use for any question about jobs, salaries, locations, skills in job ads or employers"
        ),
        system_prompt=(
            "You are a job researcher. Use recent_jobs to find jobs I have received, and web search for facts about companies. Answer short, and include job links."
        ),
        provider = "anthropic",
        tools=["web_search", "recent_jobs"],
        budget_usd=2.0,
    ),
# AGENT 2: WRITER
    AgentSpec(
        name="writer",
        description=(
            "Writes a cover letter, note, email or message for one job. "
            "Only when the task asks for written text. Never for questions. Needs research about the job first"
        ),
        system_prompt=(
            "Write a short cover letter draft, at most 250 words, in English.\n"
            "Pick the single best job from the results below, unless the task names one.\n"
            "Rules for honesty\n"
            "- Only state facts that appear in my profile or skills. Never add tools, tasks, roles or results\n"
            "- If the job needs something I do not have, do not claim it, and do not say I am learning it\n"
            "- No adjectives about me, such as strong, extensive or passionate. Let the facts speak\n"
            "- Use the exact verbs from my profile, for example 'ran', not 'managed'\n"
            "- Do not describe the employer beyond what the job text says\n"
            "- Never mention skill ratings or numbers from my skills list\n"
            "Start with one line naming the job and the link, then the letter."
        ),
        provider="ollama",
        uses_profile=True,
    ),
# WANT TO ADD MORE STANDARD AGENTS? Put them here:::
]


# Saves each starting agent in the database
if __name__ == "__main__":
    for spec in SEED_AGENTS:
        upsert_agent(spec)
        print(f"Seeded {spec.name}")