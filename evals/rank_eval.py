import re
import sys
from pathlib import Path
from app.graph import rank

######################### FILE FOR EVALUATING THE RANK AGENT #######################################
# Currently looks for:
# Correct URL used
# Correct title used
# Correct company used
# Amounts of jobs is correct

alerts = sorted(Path("evals/alerts").glob("*.txt"))
problems = 0


for path in alerts:
    alert = path.read_text(encoding="utf-8")
    text = alert.lower()
    real_urls = set(re.findall(r"https://au\.seek\.com/job/\d+", alert))
    jobs = rank({"alert_text": alert})["jobs"]
    print(f"\n{path.name}: {len(jobs)} jobs found, {len(real_urls)} in alert")
    if len(jobs) != len(real_urls):
        print("FAIL! Wrong number of jobs")
        problems += 1

    for j in jobs:
        errors = []
        pos = alert.find(j.url) if j.url else -1
        block = alert[max(0, pos - 400):pos].lower() if pos >= 0 else ""
        if j.url and j.url not in real_urls:
            errors.append("url not in alert")
        lines = [line.strip().lower() for line in block.splitlines()]
        if j.title.lower() not in lines:
            errors.append("title not a line next to its link")
        if j.company.lower() not in lines:
            errors.append("company not a line next to its link")
        status = "FAIL " + ", ".join(errors) if errors else "OK  "
        print(f"  {status} {j.title} at {j.company}")
        problems += bool(errors)

    missing = real_urls - {j.url for j in jobs}
    for url in missing:
        print(f"  MISSING {url}")

print(f"\n{problems} problems")
sys.exit(0 if problems == 0 else 1)