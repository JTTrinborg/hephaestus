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
export interface Agent {
  name: string;
  description: string;
  system_prompt: string;
  provider: "ollama" | "anthropic";
  tools: string[];
  uses_profile: boolean;
  budget_usd: number | null;
  active: boolean;
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
  supervisor_provider: "anthropic" | "ollama" | "jev";
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
