import { useState } from "react";
import { useTask } from "../api/hooks";
import type { Task } from "../api/types";
import { dateTime, duration, usd } from "../lib/format";
import { LANGFUSE_URL } from "../lib/theme";
import { RouteTimeline } from "./RouteTimeline";
import { StatusBadge } from "./StatusBadge";
import { Empty, ErrorBox, ExternalLink, Loading } from "./ui";

const GRID = "md:grid md:grid-cols-[minmax(0,1fr)_7rem_8rem_5.5rem_1.5rem] md:items-center md:gap-4";

// Tasks as expandable rows. On a phone each row becomes a small stacked card
export function TaskTable({ tasks, empty = "No tasks yet. Commission one above." }: { tasks: Task[]; empty?: string }) {
  if (tasks.length === 0) return <Empty>{empty}</Empty>;
  return (
    <div className="card overflow-hidden">
      <div className={`hidden border-b border-line bg-sunken px-4 py-2 ${GRID}`} aria-hidden="true">
        <span className="label">Task</span>
        <span className="label">Status</span>
        <span className="label">Working now</span>
        <span className="label text-right">Cost</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const panelId = `task-${task.id}`;
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-4 py-3 text-left transition-colors hover:bg-sunken/60 ${GRID}`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink" title={task.input}>
            {task.input}
          </p>
          <p className="text-xs text-muted">
            #{task.id} · {dateTime(task.created_at)}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
          <span>
            <StatusBadge status={task.status} />
          </span>
          <span className="truncate text-sm capitalize text-ink">
            {task.current_agent ?? <span className="text-muted">—</span>}
          </span>
          <span className="text-sm tabular-nums md:text-right">{usd(task.cost_usd)}</span>
          <span aria-hidden="true" className={`ml-auto text-muted transition-transform md:ml-0 ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </div>
      </button>
      {open && (
        <div id={panelId} className="border-t border-line bg-sunken/50 px-4 py-4">
          <TaskDetailPanel task={task} />
        </div>
      )}
    </li>
  );
}

function TaskDetailPanel({ task }: { task: Task }) {
  const { data, error, isLoading } = useTask(task.id, true);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data) return null;
  const took = duration(task.started_at, task.finished_at);
  const perAgent = Object.entries(data.results ?? {});

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0 space-y-4">
        <div>
          <p className="label mb-1">Task</p>
          <p className="whitespace-pre-wrap break-words text-sm">{data.input}</p>
        </div>
        {data.error && (
          <div>
            <p className="label mb-1 text-bad">Error</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-bad/10 p-3 text-xs text-bad">{data.error}</pre>
          </div>
        )}
        <div>
          <p className="label mb-1">Answer</p>
          {data.result ? (
            <div className="whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 text-sm leading-relaxed">
              {data.result}
            </div>
          ) : (
            <p className="text-sm italic text-muted">
              {data.status === "failed" ? "No answer, the task failed." : "Not ready yet."}
            </p>
          )}
        </div>
        {perAgent.length > 0 && (
          <div>
            <p className="label mb-1">Results per agent</p>
            <div className="space-y-2">
              {perAgent.map(([agent, text]) => (
                <details key={agent} className="rounded-md border border-line bg-surface">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium capitalize">{agent}</summary>
                  <p className="whitespace-pre-wrap break-words border-t border-line px-3 py-2 text-sm">{text}</p>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-4">
        <div>
          <p className="label mb-2">Route the supervisor took</p>
          <RouteTimeline route={data.route} />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="label">Cost</dt>
            <dd className="tabular-nums">{usd(task.cost_usd)}</dd>
          </div>
          <div>
            <dt className="label">Took</dt>
            <dd>{took ?? "—"}</dd>
          </div>
        </dl>
        <ExternalLink href={LANGFUSE_URL}>See the trace in Langfuse</ExternalLink>
      </div>
    </div>
  );
}
