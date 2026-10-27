import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageDay } from "../../api/types";
import { brisbaneToday, isoDay, shortDay, usd } from "../../lib/format";

// Sums every agent per day for the last `days` days, ending today in Brisbane.
// Days without calls become zero so the line doesn't skip them, and days outside the range are left out
export function dailyTotals(rows: UsageDay[], days: number, trimLeading = false) {
  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.cost_usd);
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = brisbaneToday();
    d.setDate(d.getDate() - i);
    const day = isoDay(d);
    out.push({ day, cost: byDay.get(day) ?? 0 });
  }
  // For all time, start the line at the first day with any cost
  if (trimLeading) {
    const first = out.findIndex((p) => p.cost > 0);
    return first === -1 ? out.slice(-7) : out.slice(first);
  }
  return out;
}

// Colours come from currentColor and CSS in index.css, so the chart follows the theme
export function CostLineChart({
  rows,
  days,
  height = 200,
  trimLeading = false,
  label,
}: {
  rows: UsageDay[];
  days: number;
  height?: number;
  trimLeading?: boolean;
  label: string;
}) {
  const data = dailyTotals(rows, days, trimLeading);
  return (
    <div className="text-accent" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} minTickGap={24} fontSize={12} />
          <YAxis tickFormatter={(v: number) => usd(v)} tickLine={false} axisLine={false} width={64} fontSize={12} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "currentColor", strokeOpacity: 0.3 }} />
          <Area
            type="monotone"
            dataKey="cost"
            stroke="currentColor"
            strokeWidth={2}
            fill="currentColor"
            fillOpacity={0.12}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { value: number }[];
}

function ChartTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="card px-3 py-2 text-xs text-ink">
      <p className="font-medium">{shortDay(label)}</p>
      <p className="tabular-nums">{usd(payload[0].value)}</p>
    </div>
  );
}
