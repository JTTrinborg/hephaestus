from pathlib import Path
import yaml
import os

################# FILE CONTAINING PROFILE AND SKILLS SO THAT AGENTS CAN RETRIEVE IT ######################

PROFILE = Path(os.getenv("PROFILE_PATH", "data/profile.md")).read_text(encoding="utf-8")

_skills_file = Path(os.getenv("SKILLS_PATH", "data/skills.yaml"))
if _skills_file.exists():
    _skills = yaml.safe_load(_skills_file.read_text(encoding="utf-8"))["skills"]
    SKILLS_TEXT = "\n".join(
        f"- {s['name']} ({s['category']}): {s['rating']}/10. {s.get('used') or ''}".strip()
        for s in _skills
        if s.get("rating")    # skip skills you have not rated yet
    )
else:
    SKILLS_TEXT = "See the skills section in my profile."