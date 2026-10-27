import { useState } from "react";
import { Link } from "react-router-dom";
import { useTasks } from "../api/hooks";
import type { TaskStatus } from "../api/types";
import { TaskTable } from "../components/TaskTable";
import { ErrorBox, ExternalLink, Loading } from "../components/ui";
import { LANGFUSE_URL } from "../lib/theme";

// GET /tasks returns at most 200 and has no status filter, so the newest 200 are filtered here
const LIMIT = 200;

const FILTERS: { key: TaskStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "Waiting" },
  { key: "running", label: "Running" },
  { key: "done", label: "Done" },
  { key: "failed", label: "Failed" },
];

// All tasks, filtered by status, with the same expandable rows as The Forge
export function TasksPage() {
  const tasks = useTasks(LIMIT);
  const [filter, setFilter] = useState<TaskStatus | "all">("all");

  const all = tasks.data ?? [];
  const count = (key: TaskStatus | "all") => (key === "all" ? all.length : all.filter((t) => t.status === key).length);
  const shown = filter === "all" ? all : all.filter((t) => t.status === filter);
  const label = FILTERS.find((f) => f.key === filter)!.label.toLowerCase();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Tasks</h1>
          <p className="text-sm text-muted">
            Open a row for the answer and the route the supervisor took. <ExternalLink href={LANGFUSE_URL}>Traces in Langfuse</ExternalLink>
          </p>
        </div>
        <Link to="/" className="btn-primary">
          + Commission a task
        </Link>
      </div>

      <div role="group" aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active ? "border-accent bg-accent/10 font-medium text-accent" : "border-line text-muted hover:bg-sunken hover:text-ink"
              }`}
            >
              {f.label} <span className="tabular-nums opacity-80">({count(f.key)})</span>
            </button>
          );
        })}
      </div>

      {tasks.isLoading ? (
        <Loading />
      ) : tasks.error ? (
        <ErrorBox error={tasks.error} />
      ) : (
        <>
          <TaskTable tasks={shown} empty={filter === "all" ? "No tasks yet." : `No ${label} tasks.`} />
          {all.length >= LIMIT && (
            <p className="mt-3 text-xs text-muted">Showing the newest {LIMIT} tasks. Older ones are not listed by the API.</p>
          )}
        </>
      )}
    </>
  );
}
