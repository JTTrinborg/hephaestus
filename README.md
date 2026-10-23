# Hephaestus

> Self-hosted multi-agent platform built with LangGraph. Create, schedule and monitor AI agents with cost control, evals and human-in-the-loop safety.

In Greek myth, Hephaestus forged golden automatons that worked on their own. This project forges AI agents.

**Status:** Milestones 0 to 4 of 8 done. Two systems run side by side. A daily job-search workflow reads my SEEK job alerts, ranks every job against my profile, researches the best companies and emails me a report. A team of agents led by a supervisor takes open tasks, such as finding my best jobs and drafting a cover letter. Every run is traced in a self-hosted Langfuse, every model call is costed, each agent has a monthly budget it cannot exceed, and evals measure whether the agents get it right.

---

## How it works

```mermaid
flowchart LR
    TS[Windows Task Scheduler<br/>06:00 or first boot after] -->|/ready, then webhook| WH

    subgraph n8n
        WH[Webhook] --> GM[Gmail<br/>unread SEEK alerts]
        GM --> CL[Clean text<br/>keep job links]
        CL --> HR[POST /run]
        HR --> IF{new jobs?}
        IF -->|yes| MD[Markdown to HTML] --> SE[Send report]
        SE --> MR[Mark alerts as read]
        IF -->|no| MR
    end

    HR --> API

    subgraph Hephaestus API
        API[FastAPI /run] --> RANK
    end
```

### Workflow and team

| | Morning job | Team |
|---|---|---|
| Entry | n8n → `POST /run` | You → `POST /task` |
| Task | Always the same, rank today's alert and report | Anything you ask |
| Who decides the steps | The code | A supervisor, while it runs |
| Code | `app/graph.py` | `app/team/` |

The morning job is a fixed workflow because its steps are known in advance. The team uses agents because open tasks are not. Use workflows where you can and agents where you must.

### The morning job

```mermaid
flowchart LR
    START --> rank
    rank --> dedupe
    dedupe -->|new jobs| researcher
    dedupe -->|nothing new| report
    researcher <--> tools[tools<br/>Tavily search]
    researcher --> report
    report --> END
```

| Node | Model | Job |
|---|---|---|
| `rank` | Code + Qwen3 14B, local | Code splits the alert at each job link. Qwen3 points to the lines with the title, company and location, and scores the job against my profile and skills. Code copies the lines, so a title or link can never be changed or invented |
| `dedupe` | None, plain code | Removes jobs already sent, using the SEEK job ID as key |
| `researcher` | Claude Haiku + Tavily | Looks up the companies behind the top 5 jobs. Stops itself if its monthly budget is used |
| `report` | Qwen3 14B, local | Writes the email, adds a cost summary and marks the jobs as sent |

### The team

```mermaid
flowchart LR
    START --> supervisor
    supervisor -->|next| researcher
    supervisor -->|next| writer
    supervisor -->|FINISH| END
    researcher --> supervisor
    writer --> supervisor
```

| Agent | Model | Job |
|---|---|---|
| `supervisor` | Qwen3 14B, local | Reads the task and what is done, picks who works next with structured output, and gives a reason |
| `researcher` | Claude Haiku | Finds jobs from my alerts with `recent_jobs`, and facts about companies with web search. Runs its own tool loop |
| `writer` | Qwen3 14B, local | Writes a cover letter or a note for one job from the research, my profile and my skills, with explicit honesty rules |

The agents never talk to each other directly. The researcher writes to `research` in shared state, the writer reads from it, and the supervisor only sees whether each step is done. Every decision is logged in `route_log` and in Langfuse.

A repeat guard in code stops an agent from running twice on the same task, and `recursion_limit` stops the graph if it still goes in circles.

Each agent picks the model that fits the task. My profile and skills are only ever sent to the local model.

### Observability and cost control

```mermaid
flowchart LR
    G[Graph run] -->|callback| LF[Langfuse<br/>self-hosted traces]
    G -->|track| U[(Postgres<br/>usage table)]
    U -->|check_budget| R[researcher]
    U -->|cost_summary| E[Morning email]
```

| Part | Job |
|---|---|
| **Langfuse** | One trace per run. Shows every node, prompt, response, tool call, token count and latency |
| **`usage` table** | One row per model call with agent, model, tokens and cost. The source of truth for money |
| **Budget guard** | Before each call, `researcher` checks its spend this month. Over the limit, it skips research and says so |
| **Cost summary** | Today's cost per agent and the month total, appended to every email |

Langfuse is for seeing and debugging. The `usage` table is what the platform acts on. Budgets keep working even if Langfuse is down.

---

## Evaluation

Four evals, each answering one question. All run locally today. Running them on every pull request is milestone M8.

| Eval | Question | How |
|---|---|---|
| `supervisor_eval` | Does the supervisor pick the right agent in each situation? | Code against a golden dataset of 30 decisions, threshold 90 % |
| `rank_eval` | Does `rank` find every job, with the exact title, company and link? | Code against real job alerts |
| `writer_eval` | Does the writer stick to facts from the profile? | Claude Haiku as judge, on a fictional candidate |
| `run_routing` | Does the whole team solve ten tasks end to end? | Code, from M3 |

### Supervisor

| Run | Change | Result |
|---|---|---|
| M3 baseline | First prompt | 3/10 tasks |
| M3 | Repeat guard in code | 8/10 for the system, still 3/10 for the model |
| M3 | Prompt with FINISH rules and examples | 10/10 |
| M4 | 30 single decisions, 13 of them new | 30/30 with Qwen3 |

### Rank

| Version | Missed or invented jobs | Changed titles |
|---|---|---|
| Whole alert in one call | 1 to 2 | 1, *Solution Designers* became my search term |
| Prompt fix | 2 | 0, but the job disappeared instead |
| Split in code, title as text | 0 | 6, the model tidied titles |
| Split in code, model points to line numbers | **0** | **0**, three runs in a row |

### Writer

The writer is judged on a fictional candidate, so no personal data is sent to the cloud judge. The candidate rates Kubernetes 2/10, and one test job requires Kubernetes, as a trap.

| Version | Drafts passed | Invented facts | Exaggerations |
|---|---|---|---|
| Baseline | 0/3 | 6 | 19 |
| Honesty rules in the prompt | 1/3 | 2 to 4 | 3 to 8 |

---

## Tech stack

| Layer | Tool |
|---|---|
| Orchestration | LangGraph |
| Models | Claude via API, Qwen3 via Ollama on an RX 7900 XT |
| Search | Tavily |
| API | FastAPI, Uvicorn |
| Data | PostgreSQL |
| Observability | Langfuse, self-hosted |
| Evals | Python scripts, golden datasets, LLM as judge |
| Automation | n8n, Gmail API |
| Scheduling | Windows Task Scheduler |
| Runtime | Docker Compose |

---

## Project structure

```
hephaestus/
├── app/
│   ├── __init__.py
│   ├── api.py              FastAPI endpoints
│   ├── budget.py           monthly budget guard per agent
│   ├── config.py           model selection, prices and budgets
│   ├── db.py               seen jobs, usage and cost queries in Postgres
│   ├── graph.py            the morning job workflow
│   ├── models.py           Pydantic models
│   ├── profile.py          loads my profile and skills once for all agents
│   ├── tracing.py          Langfuse config for graph runs
│   ├── usage.py            tokens and cost per model call
│   ├── team/
│   │   ├── state.py        shared state for the team
│   │   ├── supervisor.py   picks the next agent with structured output
│   │   ├── researcher.py   own tool loop with search and recent_jobs
│   │   ├── writer.py       cover letters and notes
│   │   └── graph.py        the team graph and run_task
│   └── tools/
│       ├── alerts.py       split_alert, one chunk per job link
│       ├── search.py       Tavily search tool
│       └── jobs.py         recent_jobs, reads my jobs from Postgres
├── evals/
│   ├── supervisor_cases.jsonl  golden dataset, 30 decisions
│   ├── supervisor_eval.py
│   ├── rank_eval.py
│   ├── writer_eval.py
│   ├── run_routing.py
│   ├── alerts/                 real job alerts used as test data
│   └── fixtures/               fictional candidate for the writer eval
├── n8n/
│   └── morning-jobs.json   exported n8n workflow
├── scripts/
│   └── trigger-morning.ps1 called by Task Scheduler
├── data/                   private, git-ignored (profile, skills, sample alert)
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── .env.example
```

---

## Getting started

### Requirements

- Docker Desktop
- Ollama with `qwen3:14b`, set to listen on all addresses with `OLLAMA_HOST=0.0.0.0`
- Python 3.12
- API keys for Anthropic and Tavily
- A Google Cloud OAuth client for Gmail

### 1. Configure

```powershell
copy .env.example .env
```

Fill in the keys in `.env`. Add your own profile as `data/profile.md` and skills as `data/skills.yaml`.

### 2. Start Langfuse

Langfuse runs as its own Compose project next to this repo.

```powershell
git clone https://github.com/langfuse/langfuse.git
cd langfuse
```

Create a `.env` there with your own secrets for Postgres, ClickHouse, Redis and MinIO, set `TELEMETRY_ENABLED=false`, move its Postgres to port `5433`, and bind its ports to `127.0.0.1`. Then start it.

```powershell
docker compose up -d
```

Open `http://localhost:3000`, create a project and copy its API keys into `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` in this repo's `.env`.

### 3. Start Hephaestus

```powershell
ollama pull qwen3:14b
docker compose up -d --build
```

This starts PostgreSQL, n8n and the API. Check that the API is up and can reach Ollama.

```powershell
curl http://127.0.0.1:8000/ready
```

### 4. Import the n8n workflow

Open `http://localhost:5678`, import `n8n/morning-jobs.json`, connect the Gmail and Header Auth credentials, and publish the workflow.

### 5. Schedule it

Create a Windows Task Scheduler task that runs `scripts/trigger-morning.ps1` daily at 06:00, with *Run task as soon as possible after a scheduled start is missed* and *restart every 5 minutes on failure* enabled. The script waits for `/ready` before it starts the workflow.

### Run locally

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

python -m app.graph              # the morning job on data/sample_alert.txt
python -m app.team.graph         # the team on a test task
python -m evals.supervisor_eval  # 30 supervisor decisions
python -m evals.rank_eval        # rank on real alerts in evals/alerts/
python -m evals.writer_eval      # writer judged by Haiku, fictional candidate
python -m evals.run_routing      # the whole team on ten tasks
```

---

## API

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | The API is running |
| GET | `/ready` | None | The API can reach Ollama and is ready to work |
| POST | `/run` | `X-API-Key` header | Runs the morning job on `{"alert_text": "..."}` and returns `{"report": "...", "new_jobs": 0}` |
| POST | `/task` | `X-API-Key` header | Gives the team a task with `{"task": "..."}` and returns `{"answer": "...", "route": [...]}` |

Interactive docs at `http://127.0.0.1:8000/docs`.

---

## Configuration

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY`, `TAVILY_API_KEY` | Model and search providers |
| `ANTHROPIC_MODEL`, `OLLAMA_MODEL` | Which models the agents use |
| `SUPERVISOR_PROVIDER` | `ollama` by default, `anthropic` to run the supervisor on Claude |
| `PROFILE_PATH`, `SKILLS_PATH` | Where the profile and skills are read from. Evals point these to a fictional candidate |
| `DATABASE_URL` | Postgres connection |
| `FASTAPI_KEY`, `N8N_WEBHOOK_KEY` | Separate keys for the API and the n8n webhook |
| `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` | Tracing |
| `RESEARCHER_BUDGET_USD` | Monthly budget for the researcher, default 2.0 |

---

## Security

- All ports bind to `127.0.0.1`, except Ollama, which must be reachable from the API container. Keep the network set to Private in Windows
- The API and the n8n webhook each have their own key, compared with `secrets.compare_digest`
- Secrets live in `.env` and n8n credentials, never in the repo
- Personal data is only processed by the local model. Only the researcher uses a cloud model, and it only handles public information about jobs and companies
- The writer eval uses a fictional candidate, and stops before calling the cloud judge if the real profile or skills are loaded
- Langfuse is self-hosted with telemetry and AI features off, so traces containing my profile never leave the machine
- `data/` is git-ignored

---

## Lessons learned

**A test that never fails may be a test that cannot see.** The rank eval passed a job with the wrong title three times. The first version only checked that the title appeared somewhere in the alert, and it did, in the subject line. The second checked the 400 characters before the link, and still reached the introduction. The final version requires the title to be a whole line before its own link. Always prove that a test can catch a known failure before trusting it when it passes.

**Let the model point, let code copy.** Asking the model to write out job titles made it tidy them, *Solution Designers* became *Solution Designer*. Asking it for line numbers instead, and copying the lines in code, took title errors from six to zero. The model now only does what code cannot, understanding which line is which and scoring the job.

**Split structure from judgement.** One model call both found the jobs in an alert and scored them, and it sometimes skipped a job. A prompt fix made it worse. Splitting the alert at each job link in code made missed or invented jobs impossible. The split is a reusable tool, not hardcoded agent behaviour.

**A guard can hide the problem it solves.** The supervisor routed correctly in 3 of 10 tasks, and looped on every plain question. A repeat guard in code raised the score to 8 of 10, but the model itself was still at 3. Measuring the system and the model separately showed the guard was hiding five failures. Fixing the supervisor prompt with clear rules for when to stop brought both to 10 of 10.

**Test data must be test data.** The first writer eval sent my real skills to the cloud judge, because one line in `profile.py` ignored the path override. A check now stops the eval before anything is sent if real data is loaded. Privacy rules need tests too.

**Test the same input production gets.** Alerts copied from n8n's JSON view had `\n` as text instead of line breaks, so the eval tested `rank` on input it never sees in production. `split_alert` now normalises this, and test alerts are copied from the table view.

**Don't leak test data into the prompt.** The examples in the supervisor prompt are deliberately different from the eval tasks. Using the same tasks would only measure whether the model can copy, not whether it understands.

**Use workflows where you can, agents where you must.** The morning job always does the same steps, so it stays a fixed workflow. Only open tasks go to the team. A supervisor adds a model call per step and can choose wrong, so it should only be used where the steps are not known in advance.

**Alive is not the same as ready.** The morning job failed because Ollama only listened on `127.0.0.1`, so the API container could not reach it. The trigger script did not retry, because the n8n webhook answered at once and the failure happened later. A `/ready` endpoint now checks that the API can reach Ollama from inside the container, and the script only starts the workflow when it answers.

**Never let a model create IDs.** Copying an email with Ctrl+A drops the links, so the model invented job URLs, and duplicate detection broke. The fix was to keep the real links in the n8n cleanup step and use SEEK's job ID as the key.

**Observability is not business logic.** Langfuse already counts tokens, so a separate `usage` table looks redundant. But traces are sent in the background with a delay, and the budget guard has to decide before each call. Keeping money in Postgres means budgets keep working even if Langfuse is down.

**`localhost` is not always `127.0.0.1`.** On Windows, `localhost` tried IPv6 first and every Postgres connection hung until it timed out. A full run took 5 to 10 minutes. Using `127.0.0.1` with `connect_timeout=5` brought it down to about a minute.

**Containers run the code they were built with.** Changes worked locally but not from n8n, because the API container still ran the old image. Every change in `app/` needs `docker compose up -d --build`.

**Thinking costs time.** Turning off Qwen3's reasoning mode for extraction cut the ranking step from about 45 seconds to about 10, with no visible loss in quality.

---

## Known issues

**The report model can rewrite or invent jobs.** Evals show that `rank` extracts every job correctly, with the exact title and link. The report is still written by Qwen3, and it sometimes changes a title, for example *Solution Designers* to *Solution Designer*, or adds a duplicate job. Building the report in code would remove this completely. I have kept the model for now, and the fix is ready when it is needed.

**The writer invents around missing requirements.** When a job asks for something the candidate lacks, such as Kubernetes or CI/CD, Qwen3 tends to write *limited experience with* or *currently learning*. Honesty rules in the prompt cut invented facts from 6 to between 2 and 4 per run, but do not remove them. Options are a self-check pass, removing unmet requirements from the job text in code, or a stronger model, which would break the rule that personal data stays local.

---

## Roadmap

| | Milestone | Status |
|---|---|---|
| M0 | Foundation, Docker Compose, Postgres | ✅ |
| M1 | One useful agent, daily job report | ✅ |
| M2 | Observability and cost control with Langfuse | ✅ |
| M3 | Team of agents with a supervisor | ✅ |
| M4 | Evals for supervisor, rank and writer, run locally | ✅ |
| M5 | Agent registry, task queue and routines | 🔨 |
| M6 | Dashboard | |
| M7 | MCP tools, human in the loop, guardrails | |
| M8 | Evals in CI with GitHub Actions and branch protection | |

---

## Privacy

Hephaestus is a personal project. It reads my own job alert emails and sends reports to my own inbox. No data is shared with third parties beyond the model and search APIs the project uses.
