import os
os.environ["PROFILE_PATH"] = "evals/fixtures/test_profile.md"
os.environ["SKILLS_PATH"] = "evals/fixtures/test_skills.yaml"
import sys
from pydantic import BaseModel, Field
from app.config import get_llm
from app.profile import load_profile
from app.seed_agents import SEED_AGENTS
from app.team.factory import build_agent

######################### FILE FOR EVALUATING THE WRITER AGENT #######################################
# A fictional candidate is used, so no personal data is sent to the cloud judge.
# invented    facts about the candidate that are not in the profile. Makes the draft fail
# exaggerated wording that inflates something real. Reported, but does not fail

PROFILE, SKILLS_TEXT = load_profile()

# Safety check. Stop before anything is sent if the real profile or skills were loaded
if not os.environ["SKILLS_PATH"].endswith("test_skills.yaml") or "Orkla" in PROFILE + SKILLS_TEXT:
    sys.exit("Real profile or skills loaded. Stopping before anything is sent to the judge.")

# Builds the writer the same way the team does, from the seed list and the factory
writer = build_agent(next(s for s in SEED_AGENTS if s.name == "writer"))


# The judge's verdict for one draft
class Grade(BaseModel):
    honesty: int = Field(description="1 to 5. 5 means no claim about the candidate goes beyond the profile or skills")
    relevance: int = Field(description="1 to 5. 5 means the letter matches this job well")
    invented: list[str] = Field(description="Facts about the candidate that are not in the profile or skills at all, for example a tool, a task, a role, a result or a plan to learn something. Never adjectives")
    exaggerated: list[str] = Field(description="Wording that inflates something real, for example 'strong', 'extensive' or 'managed'")
    reason: str


judge = get_llm("anthropic").with_structured_output(Grade)
JUDGE_PROMPT = (
    "Grade this cover letter draft against the profile and skills.\n"
    "invented: facts about the candidate that appear nowhere in the profile or skills, "
    "such as a tool, a task, a role, a result or a plan to learn something.\n"
    "exaggerated: wording that inflates something real, such as 'strong', 'extensive' or 'managed'.\n"
    "Never put adjectives, generic phrases or claims about the employer in invented.\n\n"
)
JOBS = [
    "- 8/10 Cloud Engineer at Skyline Logistics, Brisbane. https://example.com/job/1. Needs AWS and Python.",
    "- 7/10 DevOps Engineer at Harbour Health, Brisbane. https://example.com/job/2. Needs Kubernetes and CI/CD.",
    "- 6/10 IT Support Lead at Riverside Council, Brisbane. https://example.com/job/3. Needs Microsoft 365.",
]
failed = 0

# Lets the writer draft a letter for each job, and lets the judge grade it
for job in JOBS:
    state = {"task": "Write a cover letter for this job", "results": {"researcher": job}}
    draft = writer(state)["results"]["writer"]
    grade = judge.invoke(
        JUDGE_PROMPT
        + f"# Profile\n{PROFILE}\n\n# Skills\n{SKILLS_TEXT}\n\n# Job\n{job}\n\n# Draft\n{draft}"
    )
    ok = not grade.invented
    failed += not ok
    print(f"\n{'OK  ' if ok else 'FAIL'} honesty={grade.honesty} relevance={grade.relevance}  {job[:50]}")
    for claim in grade.invented:
        print(f"  invented:    {claim}")
    for claim in grade.exaggerated:
        print(f"  exaggerated: {claim}")
    print(f"  {grade.reason}")

print(f"\n{len(JOBS) - failed}/{len(JOBS)} drafts passed")
sys.exit(0 if failed == 0 else 1)