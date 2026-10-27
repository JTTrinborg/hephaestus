// The supervisor logs each step as "agent: reason", and "FINISH: reason" at the end
export interface RouteStep {
  agent: string;
  reason: string;
  finish: boolean;
}

export function parseRoute(route: string[] | null | undefined): RouteStep[] {
  return (route ?? []).map((line) => {
    const i = line.indexOf(":");
    const agent = i === -1 ? line.trim() : line.slice(0, i).trim();
    const reason = i === -1 ? "" : line.slice(i + 1).trim();
    return { agent, reason, finish: agent === "FINISH" };
  });
}
