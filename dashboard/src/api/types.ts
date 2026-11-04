// Shapes returned by the FastAPI backend in app/api.py

export type TaskStatus = "new" | "running" | "done" | "failed";

// GET /tasks
export interface Task {
  id: number;
  kind: string;
  input: string;
  status: TaskStatus;
  current_agent: string | null;
  route: string[] | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  project_id: number | null;
  cost_usd: number;
}

// GET /tasks/{id}
export interface TaskDetail {
  id: number;
  kind: string;
  input: string;
  status: TaskStatus;
  current_agent: string | null;
  result: string | null;
  results: Record<string, string> | null;
  route: string[] | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

// GET /agents/status
export interface AgentStatus {
  name: string;
  working: boolean;
  last_task_id: number | null;
  last_output: string;
  last_task_cost_usd: number;
  total_cost_usd: number;
}

// GET /agents, PUT /agents/{name}
// A worker writes text with a model from /models. A decider answers one typed question with Jev
export interface Agent {
  name: string;
  description: string;
  system_prompt: string;
  provider: string; // a model name from GET /models, or "jev" for deciders
  tools: string[];
  uses_profile: boolean;
  budget_usd: number | null;
  active: boolean;
  kind: "worker" | "decider";
  question: string | null;
  question_type: "choice" | "score" | "noul" | null;
  options: Record<string, string>;
}

// GET /models, PUT /models/{name}. Prices are USD per million tokens
export interface Model {
  name: string;
  kind: "anthropic" | "ollama" | "openai_compatible";
  model: string;
  base_url: string | null;
  key_env: string | null;
  local: boolean;
  price_in: number;
  price_out: number;
  key_set?: boolean; // only in GET, never sent
}

// GET /settings/keys. Only whether a key is set, never its value
export interface KeyStatus {
  name: string;
  set: boolean;
}

// GET /projects
export interface Project {
  id: number;
  name: string;
  description: string;
  active: boolean;
  created_at: string;
  tasks: number;
  cost_usd: number;
}

// GET /usage/summary
export interface UsageSummary {
  today: number;
  week: number;
  month: number;
  all_time: number;
}

// GET /usage/daily
export interface UsageDay {
  day: string;
  agent: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

// GET /profile, PUT /profile
export interface Profile {
  about: string;
  skills_yaml: string;
}

// GET /settings
export interface Settings {
  supervisor_provider: string; // a model name, or "jev"
  profile_local_only: "true" | "false";
}

// GET /routines
export interface Routine {
  name: string;
  kind: string;
  target: string;
  daily_at: string;
  active: boolean;
  last_run: string | null;
}
