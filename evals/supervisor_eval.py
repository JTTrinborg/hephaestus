import json
import sys
import time
from pathlib import Path
from app.team.supervisor import supervisor


############ EVAL FILE FOR THE SUPERVISOR AGENT ##########################


THRESHOLD = 0.9
CASES = Path("evals/supervisor_cases.jsonl")
rows = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]
hits = 0
start = time.perf_counter()



for row in rows:
# Creates a fake state to test the supervisor agent
    state = {
        "task": row["task"],
        "research": "done" if row["research"] else "",
        "draft": "done" if row["draft"] else "",
    }
    result = supervisor(state)
    got = result["next"]
    if 'blocked repeat' in result["route_log"][0]:
        got = "BLOCKED"
    ok = got == row["expected"]
    hits += ok
    flags = f"research={'y' if row['research'] else 'n'} draft={'y' if row['draft'] else 'n'}"
    print(f"{'OK  ' if ok else 'FAIL'} {flags} {row['task']} -> {got} (expected {row['expected']})")


score = hits/len(rows)
seconds = time.perf_counter() - start
print(f"\n{hits}/{len(rows)} = {score:.0%}  (threshold {THRESHOLD:.0%}, {seconds:.0f}s)")
sys.exit(0 if score >= THRESHOLD else 1)