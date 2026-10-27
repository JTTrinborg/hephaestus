import type { TaskStatus } from "../api/types";

type Status = TaskStatus | "working" | "idle" | "off";

// Colour and word together, so status never depends on colour alone
const STYLE: Record<Status, { label: string; tone: string; pulse?: boolean }> = {
  new: { label: "Waiting", tone: "text-warn bg-warn/10 border-warn/30" },
  running: { label: "Running", tone: "text-accent bg-accent/10 border-accent/40", pulse: true },
  working: { label: "Working", tone: "text-accent bg-accent/10 border-accent/40", pulse: true },
  done: { label: "Done", tone: "text-ok bg-ok/10 border-ok/30" },
  failed: { label: "Failed", tone: "text-bad bg-bad/10 border-bad/30" },
  idle: { label: "Idle", tone: "text-idle bg-idle/10 border-idle/30" },
  off: { label: "Off", tone: "text-idle bg-transparent border-idle/30" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STYLE[status] ?? STYLE.idle;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full bg-current ${s.pulse ? "pulse-dot" : ""}`} />
      {s.label}
    </span>
  );
}
