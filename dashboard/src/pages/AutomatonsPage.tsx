import { useEffect, useRef, useState } from "react";
import { useAgents, useAgentStatus, useLive, useModels, useSetActive, useSettings } from "../api/hooks";
import type { Agent, AgentStatus, Model } from "../api/types";
import { AgentForm, QUESTION_TYPES } from "../components/AgentForm";
import { DeleteButton } from "../components/DeleteButton";
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
  const models = useModels();
  const [editing, setEditing] = useState<Editing>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing]);

  const statusByName = new Map((status.data ?? []).map((s) => [s.name, s]));
  const modelByName = new Map((models.data ?? []).map((m) => [m.name, m]));
  // The API has no list of tools, so the form suggests the ones other agents already use
  const knownTools = [...new Set((agents.data ?? []).flatMap((a) => a.tools))].sort();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Automatons</h1>
          <p className="text-sm text-muted">
            Agents are rows in the registry. Turning one off keeps it, deleting removes it. <ExternalLink href={LANGFUSE_URL}>Traces in Langfuse</ExternalLink>
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
          {models.isLoading ? (
            <Loading />
          ) : (
            <AgentForm
              key={editing === "new" ? "new" : editing.name}
              agent={editing === "new" ? null : editing}
              knownTools={knownTools}
              models={models.data ?? []}
              profileLocalOnly={settings.data?.profile_local_only !== "false"}
              onDone={() => setEditing(null)}
            />
          )}
          {models.error && <ErrorBox error={models.error} />}
        </div>
      )}

      {agents.isLoading ? (
        <Loading />
      ) : agents.error ? (
        <ErrorBox error={agents.error} />
      ) : agents.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {agents.data.map((a) => (
            <AgentPanel
              key={a.name}
              agent={a}
              status={statusByName.get(a.name)}
              model={modelByName.get(a.provider)}
              onEdit={() => setEditing(a)}
            />
          ))}
        </div>
      ) : (
        <Empty>No automatons yet. Forge the first one.</Empty>
      )}
    </>
  );
}

function AgentPanel({
  agent,
  status,
  model,
  onEdit,
}: {
  agent: Agent;
  status?: AgentStatus;
  model?: Model;
  onEdit: () => void;
}) {
  const setActive = useSetActive();
  const working = !!status?.working;
  const state = !agent.active ? "off" : working ? "working" : "idle";
  const decider = agent.kind === "decider";

  return (
    <article className={`card flex flex-col gap-3 p-4 ${working ? "ember" : ""} ${agent.active ? "" : "opacity-75"}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold capitalize">{agent.name}</h2>
          <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{decider ? "Decider" : "Worker"}</span>
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

      {decider ? <DeciderDetails agent={agent} status={status} /> : <WorkerDetails agent={agent} status={status} model={model} />}

      {setActive.isError && <ErrorBox error={setActive.error} />}

      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5" onClick={onEdit}>
          Edit
        </button>
        <DeleteButton
          path={`/agents/${encodeURIComponent(agent.name)}`}
          what={<>the agent <strong>{agent.name}</strong></>}
          consequence="Its usage history stays. To keep the agent but stop using it, turn it off instead."
          invalidate={[["agents"]]}
        />
      </div>
    </article>
  );
}

function WorkerDetails({ agent, status, model }: { agent: Agent; status?: AgentStatus; model?: Model }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-sm sm:grid-cols-4">
      <div className="min-w-0">
        <dt className="label">Model</dt>
        <dd className="truncate" title={model ? `${model.name}: ${model.model}` : agent.provider}>
          {agent.provider}
          <span className="block text-xs text-muted">
            {model ? `${model.local ? "local" : "cloud"}${model.key_set === false ? ", key missing" : ""}` : "not in the registry"}
          </span>
        </dd>
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
  );
}

// A decider shows its question, its options and the answer Jev gave last time
function DeciderDetails({ agent, status }: { agent: Agent; status?: AgentStatus }) {
  const type = QUESTION_TYPES.find((q) => q.value === agent.question_type);
  const options = Object.entries(agent.options);
  return (
    <dl className="space-y-3 border-t border-line pt-3 text-sm">
      <div>
        <dt className="label">Question</dt>
        <dd className="italic">“{agent.question}”</dd>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <dt className="label">Type</dt>
          <dd>{type?.name ?? agent.question_type}</dd>
        </div>
        <div>
          <dt className="label">Model</dt>
          <dd>Jev</dd>
        </div>
      </div>
      {options.length > 0 && (
        <div>
          <dt className="label">{type?.options ?? "Options"}</dt>
          <dd>
            <ul className="mt-1 space-y-1">
              {options.map(([name, description]) => (
                <li key={name}>
                  <span className="rounded-full border border-line bg-sunken px-2 py-0.5 font-mono text-xs">{name}</span>
                  {description && <span className="ml-2 text-muted">{description}</span>}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      <div className="rounded-md border border-line bg-sunken/60 px-3 py-2">
        <dt className="label">
          Last answer
          {status?.last_task_id != null && <span className="ml-1 normal-case tracking-normal">· task #{status.last_task_id}</span>}
        </dt>
        <dd className="mt-0.5 font-medium">
          {status?.last_output ? (
            status.last_output
          ) : (
            <span className="font-normal italic text-muted">{agent.active ? "No answer yet" : "Not shown while turned off"}</span>
          )}
        </dd>
      </div>
    </dl>
  );
}
