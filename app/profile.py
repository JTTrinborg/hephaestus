from pathlib import Path
import yaml
import os

################# FILE CONTAINING PROFILE AND SKILLS SO THAT AGENTS CAN RETRIEVE IT ######################

# Formats the skills YAML as short lines the model can read
def skills_text(skills_yaml: str) -> str:
    skills = (yaml.safe_load(skills_yaml) or {}).get("skills") or []
    return "\n".join(
        f"- {s['name']} ({s['category']}): {s['rating']}/10. {s.get('used') or ''}".strip()
        for s in skills
        if s.get("rating")
    )



# Reads profile and skills from the files, used by the evals and as a fallback
def from_files() -> tuple[str, str]:
    about = Path(os.getenv("PROFILE_PATH", "data/profile.md")).read_text(encoding="utf-8")
    skills_file = Path(os.getenv("SKILLS_PATH", "data/skills.yaml"))
    skills = skills_file.read_text(encoding="utf-8") if skills_file.exists() else "skills: []"
    return about, skills


# Profile and skills text for the prompts, from the database unless the evals set a test file
def load_profile() -> tuple[str, str]:
    if os.getenv("PROFILE_PATH") or not os.getenv("DATABASE_URL"):
        about, skills = from_files()
    else:
        from app.db import get_profile_row
        about, skills = get_profile_row() or from_files()
    return about, skills_text(skills)


# Copies the files into the database once
if __name__ == "__main__":
    from app.db import save_profile
    save_profile(*from_files())
    print("Profile saved to the database")