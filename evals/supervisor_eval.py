import json
import sys
import time
from pathlib import Path
from app.seed_agents import SEED_AGENTS
from app.team.supervisor import build_supervisor


############ EVAL FILE FOR THE SUPERVISOR AGENT ##########################


THRESHOLD = 0.9
CASES = Path("evals/supervisor_cases.jsonl")
rows = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]
hits = 0
start = time.perf_counter()
# Reads the model to test from the command, for example jev
provider = sys.argv[1] if len(sys.argv) > 1 else None
supervisor = build_supervisor(SEED_AGENTS, provider)



for row in rows:
# Creates a fake state to test the supervisor agent
    results = {}
    if row["research"]:
        results["researcher"] = "done"
    if row["draft"]:
        results["writer"] = "done"
    state = {"task": row["task"], "results": results}

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