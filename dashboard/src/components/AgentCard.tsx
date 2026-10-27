import type { AgentStatus } from "../api/types";
import { usd } from "../lib/format";
import { StatusBadge } from "./StatusBadge";

// One automaton on The Forge. A working one glows like an ember
export function AgentCard({ agent }: { agent: AgentStatus }) {
  return (
    <article className={`card flex flex-col gap-3 p-4 transition-shadow ${agent.working ? "ember" : ""}`}>
      <header className="flex items-start justify-between gap-2">
        <h3 className="truncate text-base font-semibold capitalize text-ink" title={agent.name}>
          {agent.name}
        </h3>
        <StatusBadge status={agent.working ? "working" : "idle"} />
      </header>
      <div className="min-h-[4.5rem]">
        <p className="label mb-1">
          Last output
          {agent.last_task_id !== null && <span className="ml-1 normal-case tracking-normal">· task #{agent.last_task_id}</span>}
        </p>
        <p className="line-clamp-3 text-sm text-ink/90" title={agent.last_output || undefined}>
          {agent.last_output || <span className="italic text-muted">Nothing yet</span>}
        </p>
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-line pt-3 text-sm">
        <div>
          <dt className="label">Last task</dt>
          <dd className="font-medium tabular-nums">{usd(agent.last_task_cost_usd)}</dd>
        </div>
        <div>
          <dt className="label">Total</dt>
          <dd className="font-medium tabular-nums">{usd(agent.total_cost_usd)}</dd>
        </div>
      </dl>
    </article>
  );
}
