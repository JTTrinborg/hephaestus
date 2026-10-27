import { parseRoute } from "../lib/route";

// The steps the supervisor took, each with its reason
export function RouteTimeline({ route }: { route: string[] | null }) {
  const steps = parseRoute(route);
  if (steps.length === 0) return <p className="text-sm italic text-muted">No steps yet.</p>;
  return (
    <ol className="relative ml-2 border-l border-line">
      {steps.map((s, i) => (
        <li key={i} className="relative pb-3 pl-5 last:pb-0">
          <span
            aria-hidden="true"
            className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${s.finish ? "bg-ok" : "bg-accent"}`}
          />
          <p className="text-sm">
            <span className="mr-1 text-xs text-muted tabular-nums">{i + 1}.</span>
            <span className="font-semibold capitalize">{s.finish ? "Finished" : s.agent}</span>
            {s.reason && <span className="text-muted"> — {s.reason}</span>}
          </p>
        </li>
      ))}
    </ol>
  );
}
