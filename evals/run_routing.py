import json
import sys
from datetime import datetime
from pathlib import Path
from langgraph.errors import GraphRecursionError
from app.team.graph import run_task



############## SCRIPT TO TEST CONSISTENCY OF AGENTS ##################

CASES = [
    ("Find my three best jobs and write a draft for the best one", ["researcher", "writer"]),
    ("What does Gilmour Space do?", ["researcher"]),
    ("Which of my jobs are in Brisbane?", ["researcher"]),
    ("Write a cover letter for the City of Gold Coast job", ["researcher", "writer"]),
    ("Hi", []),
    ("Book me a flight to Sydney", []),
    ("Is VenueSumo a good place to work?", ["researcher"]),
    ("List my jobs with score 8 or higher", ["researcher"]),
    ("Write a short note to a recruiter about the Platform Engineer role", ["researcher", "writer"]),
    ("Compare the two best jobs I got this week", ["researcher"]),
]

note = sys.argv[1] if len(sys.argv) > 1 else ""
out = Path("evals/routing_notes.jsonl")
hits = 0
clean = 0

with out.open("w", encoding="utf-8") as f:
    for task, expected in CASES:
        try:
            result = run_task(task)
            actual = [line.split(":")[0] for line in result["route_log"] if not line.startswith("FINISH")]
            blocked = any("blocked repeat" in line for line in result["route_log"])
        except GraphRecursionError:
            actual = ["LOOP"]
            blocked = False

        ok = actual == expected
        hits += ok
        clean += ok and not blocked

        f.write(json.dumps({
            "task": task,
            "expected": expected,
            "actual": actual,
            "ok": ok,
            "blocked": blocked,
        }) + "\n")
        print(f"{'OK  ' if ok else 'FAIL'}{' (blocked)' if blocked else ''} {task} -> {actual}")

print(f"\nSystem:     {hits}/{len(CASES)} correct")
print(f"Supervisor: {clean}/{len(CASES)} correct without the repeat guard")

with Path("evals/routing_history.csv").open("a", encoding="utf-8") as h:
    h.write(f"{datetime.now():%Y-%m-%d %H:%M},{hits},{clean},{len(CASES)},{note}\n")