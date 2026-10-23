from app.config import get_llm
from app.profile import PROFILE, SKILLS_TEXT
from app.usage import track


################# FILE FOR THE WRITER AGENT #########################


NAME = 'writer'
llm = get_llm("ollama")

def writer(state: dict) -> dict:
    prompt = (
        "Write a short cover letter draft, at most 250 words, in English.\n"
        "Pick the single best job from the research below, unless the task names one.\n"
        "Rules for honesty\n"
        "- Only state facts that appear in my profile or skills. Never add tools, tasks, roles or results\n"
        "- If the job needs something I do not have, do not claim it, and do not say I am learning it\n"
        "- No adjectives about me, such as strong, extensive or passionate. Let the facts speak\n"
        "- Use the exact verbs from my profile, for example 'ran', not 'managed'\n"
        "- Do not describe the employer beyond what the job text says\n"
        "- Never mention skill ratings or numbers from my skills list\n"    # ← ny
        "Start with one line naming the job and the link, then the letter.\n\n"
        f"# Task\n{state['task']}\n\n"
        f"# Research\n{state['research']}\n\n"
        f"# My profile\n{PROFILE}\n\n"
        f"# My skills\n{SKILLS_TEXT}"
    )
    response = llm.invoke(prompt)
    track(NAME, response)
    return {"draft": response.text}