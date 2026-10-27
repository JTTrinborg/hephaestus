import { useEffect, useRef, useState } from "react";
import { useAgents, useAgentStatus, useLive, useSetActive, useSettings } from "../api/hooks";
import type { Agent, AgentStatus } from "../api/types";
import { AgentForm } from "../components/AgentForm";
import { StatusBadge } from "../components/StatusBadge";
import { Toggle } from "../components/Toggle";
import { Empty, ErrorBox, ExternalLink, Loading } from "../components/ui";
import { usd } from "../lib/format";
import { LANGFUSE_URL } from "../lib/theme";

// null means the form is closed, "new" a new agent, otherwise the agent being edited
type Editing = null | "new" | Agent;

// All agents in the registry, with a form to create or edit one and a switch for active
export function AutomatonsPage() {
  const live = useLive();
  const agents = useAgents();
  const status = useAgentStatus(live);
  const settings = useSettings();
  const [editing, setEditing] = useState<Editing>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing]);

  const statusByName = new Map((status.data ?? []).map((s) => [s.name, s]));
  // The API has no list of tools, so the form suggests the ones other agents already use
  const knownTools = [...new Set((agents.data ?? []).flatMap((a) => a.tools))].sort();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Automatons</h1>
          <p className="text-sm text-muted">
            Agents are rows in the registry. Turning one off keeps its history. <ExternalLink href={LANGFUSE_URL}>Traces in Langfuse</ExternalLink>
          </p>
        </div>
        {!editing && (
          <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
            + New automaton
          </button>
        )}
      </div>

      {editing && (
        <div ref={formRef} className="mb-8 scroll-mt-24">
          <AgentForm
            key={editing === "new" ? "new" : editing.name}
            agent={editing === "new" ? null : editing}
            knownTools={knownTools}
            profileLocalOnly={settings.data?.profile_local_only !== "false"}
            onDone={() => setEditing(null)}
          />
        </div>
      )}

      {agents.isLoading ? (
        <Loading />
      ) : agents.error ? (
        <ErrorBox error={agents.error} />
      ) : agents.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.data.map((a) => (
            <AgentPanel key={a.name} agent={a} status={statusByName.get(a.name)} onEdit={() => setEditing(a)} />
          ))}
        </div>
      ) : (
        <Empty>No automatons yet. Forge the first one.</Empty>
      )}
    </>
  );
}

function AgentPanel({ agent, status, onEdit }: { agent: Agent; status?: AgentStatus; onEdit: () => void }) {
  const setActive = useSetActive();
  const working = !!status?.working;
  const state = !agent.active ? "off" : working ? "working" : "idle";

  return (
    <article className={`card flex flex-col gap-3 p-4 ${working ? "ember" : ""} ${agent.active ? "" : "opacity-75"}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-lg font-semibold capitalize">{agent.name}</h2>
          <StatusBadge status={state} />
        </div>
        <Toggle
          checked={agent.active}
          label={`${agent.name} active`}
          disabled={setActive.isPending}
          onChange={(active) => setActive.mutate({ name: agent.name, active })}
        />
      </header>

      <p className="text-sm text-ink/90">{agent.description}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="label">Model</dt>
          <dd>{agent.provider === "anthropic" ? "Claude, cloud" : "Qwen3, local"}</dd>
        </div>
        <div>
          <dt className="label">Budget</dt>
          <dd className="tabular-nums">{agent.budget_usd === null ? "No limit" : `${usd(agent.budget_usd)} / mo`}</dd>
        </div>
        <div>
          <dt className="label">Profile</dt>
          <dd>{agent.uses_profile ? "May read" : "No access"}</dd>
        </div>
        <div>
          <dt className="label">Total cost</dt>
          <dd className="tabular-nums">{status ? usd(status.total_cost_usd) : "—"}</dd>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <dt className="label">Tools</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {agent.tools.length ? (
              agent.tools.map((t) => (
                <span key={t} className="rounded-full border border-line bg-sunken px-2 py-0.5 font-mono text-xs">
                  {t}
                </span>
              ))
            ) : (
              <span className="text-muted">None</span>
            )}
          </dd>
        </div>
      </dl>

      {setActive.isError && <ErrorBox error={setActive.error} />}

      <div className="mt-auto flex gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5" onClick={onEdit}>
          Edit
        </button>
      </div>
    </article>
  );
}
