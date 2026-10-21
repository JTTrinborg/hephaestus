from pathlib import Path
import yaml

################# FILE CONTAINING PROFILE AND SKILLS SO THAT AGENTS CAN RETRIEVE IT ######################

PROFILE = Path("data/profile.md").read_text(encoding="utf-8")

_skills = yaml.safe_load(Path('data/skills.yaml').read_text(encoding="utf-8"))["skills"]
SKILLS_TEXT = '\n'.join(
    f"- {s['name']} ({s['category']}): {s['rating']}/10. {s.get('used') or ''}".strip()
    for s in _skills
)