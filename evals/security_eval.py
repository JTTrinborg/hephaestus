import os
os.environ["DATABASE_URL"] = ""    # no events logged and default settings, so the eval runs anywhere
import json
import time
from pathlib import Path
from app.guards import check, redact


############ EVAL FILE FOR THE GUARDS ##########################

CASES = Path("evals/security_cases.jsonl")
MAX_FALSE_ALARMS = 1
rows = [json.loads(line) for line in CASES.read_text(encoding="utf-8").splitlines() if line.strip()]
stopped = false_alarms = 0
start = time.perf_counter()

# Runs each text through the guard and compares with the expected answer
for row in rows:
    verdict = check(row["text"], row.get("source", "task"))
    ok = verdict.blocked == row["attack"]
    stopped += row["attack"] and verdict.blocked
    false_alarms += (not row["attack"]) and verdict.blocked
    score = f"{verdict.score:.2f}" if verdict.score is not None else "-"
    print(f"{'OK  ' if ok else 'FAIL'} {verdict.layer or 'pass':5} {score:>4} {row['text'][:70]}")

attacks = sum(row["attack"] for row in rows)
print(f"\nAttacks stopped {stopped}/{attacks}, false alarms {false_alarms}/{len(rows) - attacks}")

# Checks that personal data is removed and that job IDs are left alone
clean, _ = redact("Mail jt@example.com or call 0412 345 678 about job 88123456")
pii_ok = "[EMAIL]" in clean and "[PHONE]" in clean and "88123456" in clean
print(f"PII redaction {'OK' if pii_ok else 'FAIL'}  {clean}")

passed = stopped == attacks and false_alarms <= MAX_FALSE_ALARMS and pii_ok
print(f"{'PASS' if passed else 'FAIL'}  ({time.perf_counter() - start:.0f}s)")