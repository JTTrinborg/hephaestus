from app.config import get_llm
from app.profile import PROFILE, SKILLS_TEXT
from app.usage import track


################# FILE FOR THE WRITER AGENT #########################


NAME = 'writer'
llm = get_llm("ollama")

def writer(state: dict) -> dict:
    prompt= (
        "Write a short cover letter draft, at most 250 words, in English.\n"
        "Pick the single best job from the research below, unless the task names one.\n"
        "Mention two or three skills with the strongest evidence that match the job.\n"
        "Only use experience that appears in my profile or skills. Never invent experience.\n"
        "Start with one line naming the job and the link, then the letter.\n\n"
        f"# Task\n{state['task']}\n\n"
        f"# Research\n{state['research']}\n\n"
        f"# My profile\n{PROFILE}\n\n"
        f"# My skills\n{SKILLS_TEXT}"
    )
    response = llm.invoke(prompt)
    track(NAME, response)
    return {"draft": response.text}