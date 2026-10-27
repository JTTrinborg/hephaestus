import type { UsageSummary } from "../api/types";
import { brisbaneToday, usd } from "../lib/format";

export type Period = keyof UsageSummary;

export const PERIODS: { key: Period; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all_time", label: "All time" },
];

// How many days of /usage/daily a period needs, counted like the backend does in Brisbane time.
// The API returns at most 365 days, so all time is the last year
export function periodDays(period: Period): number {
  const today = brisbaneToday();
  if (period === "today") return 1;
  if (period === "week") return ((today.getDay() + 6) % 7) + 1; // the week starts on Monday
  if (period === "month") return today.getDate();
  return 365;
}

// The four totals. Each tile is a button that picks the period the chart shows
export function CostTotals({
  summary,
  selected,
  onSelect,
}: {
  summary: UsageSummary | undefined;
  selected: Period;
  onSelect: (p: Period) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="group" aria-label="Choose the period for the chart">
      {PERIODS.map((t) => {
        const active = t.key === selected;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(t.key)}
            className={`card px-4 py-3 text-left transition-colors ${
              active ? "border-accent bg-accent/5 ring-1 ring-accent" : "hover:bg-sunken"
            }`}
          >
            <span className={`label flex items-center justify-between ${active ? "text-accent" : ""}`}>
              {t.label}
              {active && <span className="normal-case tracking-normal">In chart</span>}
            </span>
            <span className="mt-1 block font-display text-2xl font-semibold tabular-nums text-ink">
              {summary ? usd(summary[t.key]) : "—"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
