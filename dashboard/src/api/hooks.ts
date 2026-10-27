import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { AgentStatus, Task, TaskDetail, UsageDay, UsageSummary } from "./types";

export const FAST = 3_000;
export const SLOW = 30_000;

const isLive = (tasks: Task[] | undefined) =>
  !!tasks?.some((t) => t.status === "new" || t.status === "running");

// The newest tasks. Polls every 3 s while one is waiting or running, otherwise every 30 s
export function useTasks(limit: number) {
  return useQuery({
    queryKey: ["tasks", limit],
    queryFn: () => api<Task[]>(`/tasks?limit=${limit}`),
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

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (task: string) => api<{ id: number }>("/tasks", { method: "POST", body: { task } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
