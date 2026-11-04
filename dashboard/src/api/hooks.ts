import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  Agent,
  AgentStatus,
  KeyStatus,
  Model,
  Profile,
  Project,
  Routine,
  Settings,
  Task,
  TaskDetail,
  UsageDay,
  UsageSummary,
} from "./types";

export const FAST = 3_000;
export const SLOW = 30_000;

const isLive = (tasks: Task[] | undefined) =>
  !!tasks?.some((t) => t.status === "new" || t.status === "running");

// The newest tasks, optionally for one project. Polls every 3 s while one is waiting or running, otherwise every 30 s
export function useTasks(limit: number, projectId?: number) {
  return useQuery({
    queryKey: ["tasks", limit, projectId ?? null],
    queryFn: () => api<Task[]>(`/tasks?limit=${limit}${projectId !== undefined ? `&project_id=${projectId}` : ""}`),
    refetchInterval: (q) => (isLive(q.state.data) ? FAST : SLOW),
  });
}

// True while any task is waiting or running, so other panels can poll at the same pace
export function useLive() {
  const { data } = useTasks(10);
  return isLive(data);
}

// One task with its answer, loaded when its row is opened
export function useTask(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => api<TaskDetail>(`/tasks/${id}`),
    enabled,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === "new" || s === "running" ? FAST : false;
    },
  });
}

export function useAgentStatus(live: boolean) {
  return useQuery({
    queryKey: ["agents", "status"],
    queryFn: () => api<AgentStatus[]>("/agents/status"),
    refetchInterval: live ? FAST : SLOW,
  });
}

export function useUsageSummary(live: boolean) {
  return useQuery({
    queryKey: ["usage", "summary"],
    queryFn: () => api<UsageSummary>("/usage/summary"),
    refetchInterval: live ? FAST : SLOW,
  });
}

export function useUsageDaily(days: number, live: boolean) {
  return useQuery({
    queryKey: ["usage", "daily", days],
    queryFn: () => api<UsageDay[]>(`/usage/daily?days=${days}`),
    refetchInterval: live ? FAST : SLOW,
    // Keep the old chart on screen while another period loads
    placeholderData: keepPreviousData,
  });
}

// Every agent in the registry, also those turned off
export function useAgents() {
  return useQuery({
    queryKey: ["agents", "list"],
    queryFn: () => api<Agent[]>("/agents"),
  });
}

// Creates or changes an agent. The name in the URL and the body must match
export function useSaveAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agent: Agent) =>
      api<Agent>(`/agents/${encodeURIComponent(agent.name)}`, { method: "PUT", body: agent }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

// Turns an agent on or off
export function useSetActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, active }: { name: string; active: boolean }) =>
      api<Agent>(`/agents/${encodeURIComponent(name)}`, { method: "PATCH", body: { active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/settings"),
  });
}

// Changes one setting. The API only accepts the allowed values
export function useSetSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: keyof Settings; value: string }) =>
      api<Record<string, string>>(`/settings/${key}`, { method: "PUT", body: { value } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useRoutines() {
  return useQuery({
    queryKey: ["routines"],
    queryFn: () => api<Routine[]>("/routines"),
  });
}

// Changes the time of day or turns a routine on or off. Fields left out stay as they are
export function useUpdateRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, ...changes }: { name: string; daily_at?: string; active?: boolean }) =>
      api(`/routines/${encodeURIComponent(name)}`, { method: "PATCH", body: changes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["routines"] }),
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile>("/profile"),
    // Never refetch behind the user's back while they edit
    refetchOnWindowFocus: false,
  });
}

// Saves the profile. The API checks the YAML and answers 400 with the reason if it is invalid
export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) => api<{ saved: boolean }>("/profile", { method: "PUT", body: profile }),
    onSuccess: (_, profile) => qc.setQueryData(["profile"], profile),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { task: string; project_id: number | null }) =>
      api<{ id: number }>("/tasks", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// The model registry, with whether each model's key is set
export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: () => api<Model[]>("/models"),
  });
}

// Creates or changes a model. key_set is read-only, so it is left out
export function useSaveModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key_set: _, ...model }: Model) =>
      api<Model>(`/models/${encodeURIComponent(model.name)}`, { method: "PUT", body: model }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["models"] });
      qc.invalidateQueries({ queryKey: ["keys"] });
    },
  });
}

// Which keys are set in .env. The API never returns a value
export function useKeys() {
  return useQuery({
    queryKey: ["keys"],
    queryFn: () => api<KeyStatus[]>("/settings/keys"),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api<Project[]>("/projects"),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description: string }) =>
      api<{ id: number }>("/projects", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

// Deletes one thing by path, for example /agents/writer. A 409 detail says why it can't be deleted now
export function useDelete(invalidate: string[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (path: string) => api(path, { method: "DELETE" }),
    onSuccess: () => invalidate.forEach((queryKey) => qc.invalidateQueries({ queryKey })),
  });
}
