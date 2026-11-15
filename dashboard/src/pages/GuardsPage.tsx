import { useState } from "react";
import { Link } from "react-router-dom";
import { useGuardEvents } from "../api/hooks";
import type { GuardAction, GuardEvent, GuardName } from "../api/types";
import { Empty, ErrorBox, Loading } from "../components/ui";
import { dateTime } from "../lib/format";

const PAGE = 50;

const FILTERS: { key: GuardName | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "input", label: "Input" },
  { key: "tool", label: "Tool" },
  { key: "pii", label: "PII" },
  { key: "output", label: "Output" },
];

// Colour and word together. Blocked is as serious as a failed task, flagged needs a look, redacted is routine
const ACTION_STYLE: Record<GuardAction, string> = {
  blocked: "text-bad bg-bad/10 border-bad/30",
  flagged: "text-warn bg-warn/10 border-warn/30",
  redacted: "text-idle bg-idle/10 border-idle/30",
};

const GRID =
  "md:grid md:grid-cols-[6.5rem_4rem_5.5rem_6.5rem_minmax(0,1fr)_3.5rem_4.5rem] md:items-start md:gap-3";

// Every time a guard blocked, flagged or redacted something, newest first, filtered by guard
export function GuardsPage() {
  const [filter, setFilter] = useState<GuardName | "all">("all");
  const [limit, setLimit] = useState(PAGE);
  const events = useGuardEvents(limit, filter === "all" ? undefined : filter);
  const rows = events.data ?? [];
  const label = FILTERS.find((f) => f.key === filter)!.label;

  return (
    <>
      <div className="mb-6 border-b border-line pb-3">
        <h1 className="text-2xl font-semibold">Guards</h1>
        <p className="text-sm text-muted">
          Input checks the task, tool checks what tools return, PII hides personal data, output checks the answer. Checked every 30 seconds.
        </p>
      </div>

      <div role="group" aria-label="Filter by guard" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setFilter(f.key);
                setLimit(PAGE);
              }}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active ? "border-accent bg-accent/10 font-medium text-accent" : "border-line text-muted hover:bg-sunken hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {events.isLoading ? (
        <Loading />
      ) : events.error ? (
        <ErrorBox error={events.error} />
      ) : rows.length === 0 ? (
        <Empty>{filter === "all" ? "No guard events yet." : `No events from the ${label.toLowerCase()} guard.`}</Empty>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className={`hidden border-b border-line bg-sunken px-4 py-2 ${GRID}`} aria-hidden="true">
              <span className="label">When</span>
              <span className="label">Guard</span>
              <span className="label">Action</span>
              <span className="label">Source</span>
              <span className="label">Reason</span>
              <span className="label text-right">Score</span>
              <span className="label">Task</span>
            </div>
            <ul className="divide-y divide-line" aria-label="Guard events">
              {rows.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            </ul>
          </div>
          {rows.length >= limit && (
            <button type="button" className="btn-ghost mt-3" onClick={() => setLimit((l) => l + PAGE)} disabled={events.isFetching}>
              {events.isFetching ? "Loading…" : `Show ${PAGE} more`}
            </button>
          )}
        </>
      )}
    </>
  );
}

// One event. On a phone the cells wrap into a small stacked card, with the names in front
function EventRow({ event }: { event: GuardEvent }) {
  return (
    <li className={`px-4 py-3 text-sm ${GRID}`}>
      <span className="block text-xs text-muted md:pt-0.5">{dateTime(event.created_at)}</span>
      <div className="mt-1 flex flex-wrap items-center gap-2 md:contents">
        <span className="font-medium uppercase md:pt-0.5">
          <span className="sr-only md:hidden">Guard: </span>
          {event.guard}
        </span>
        <span>
          <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ACTION_STYLE[event.action]}`}>
            {event.action}
          </span>
        </span>
        <span className="min-w-0 truncate text-muted md:pt-0.5" title={event.source}>
          <span className="md:hidden">from </span>
          {event.source}
        </span>
      </div>
      <div className="mt-1 min-w-0 md:mt-0 md:pt-0.5">
        <p className="break-words">{event.reason}</p>
        {event.excerpt && (
          <p className="mt-1 line-clamp-2 break-words rounded bg-sunken px-2 py-1 font-mono text-xs text-ink/80" title={event.excerpt}>
            {event.excerpt}
          </p>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 text-xs md:contents md:text-sm">
        <span className="tabular-nums md:pt-0.5 md:text-right">
          <span className="text-muted md:hidden">Score </span>
          {event.score !== null ? event.score.toFixed(2) : <span className="text-muted">—</span>}
        </span>
        <span className="md:pt-0.5">
          {event.task_id !== null ? (
            <Link to={`/tasks?task=${event.task_id}`} className="text-accent hover:underline">
              <span className="md:hidden">Task </span>#{event.task_id}
            </Link>
          ) : (
            <span className="text-muted">No task</span>
          )}
        </span>
      </div>
    </li>
  );
}
