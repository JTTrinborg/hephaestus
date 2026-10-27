import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageDay } from "../../api/types";
import { brisbaneToday, isoDay, shortDay, usd } from "../../lib/format";
import { MAX_SERIES, colorFor, useThemeName } from "../../lib/series";

const OTHER = "other";

// One row per day with a cost column per agent. Agents past the eighth colour fold into "other"
function byDay(rows: UsageDay[], days: number, order: string[]) {
  const keep = new Set(order.slice(0, MAX_SERIES));
  const map = new Map<string, Record<string, number | string>>();
  for (let i = days - 1; i >= 0; i--) {
    const d = brisbaneToday();
    d.setDate(d.getDate() - i);
    map.set(isoDay(d), { day: isoDay(d) });
  }
  for (const r of rows) {
    const row = map.get(r.day);
    if (!row) continue;
    const key = keep.has(r.agent) ? r.agent : OTHER;
    row[key] = ((row[key] as number) ?? 0) + r.cost_usd;
  }
  return [...map.values()];
}

// Cost per day, stacked by agent, with a legend so identity never rests on colour alone
export function StackedCostChart({ rows, days, order, height = 280 }: { rows: UsageDay[]; days: number; order: string[]; height?: number }) {
  const theme = useThemeName();
  const series = order.slice(0, MAX_SERIES).concat(order.length > MAX_SERIES ? [OTHER] : []);
  // Only agents with any cost in the period get a bar and a legend entry
  const paid = series.filter((a) => rows.some((r) => (a === OTHER ? !order.slice(0, MAX_SERIES).includes(r.agent) : r.agent === a) && r.cost_usd > 0));
  const data = byDay(rows, days, order);

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        {paid.map((a) => (
          <li key={a} className="inline-flex items-center gap-1.5 capitalize">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colorFor(order, a, theme) }} />
            {a}
          </li>
        ))}
      </ul>
      <div role="img" aria-label={`Cost per day for the last ${days} days, stacked by agent. The table below has the numbers`}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={days > 45 ? 1 : "20%"}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickFormatter={shortDay} tickLine={false} axisLine={false} minTickGap={24} fontSize={12} />
            <YAxis tickFormatter={(v: number) => usd(v)} tickLine={false} axisLine={false} width={64} fontSize={12} />
            <Tooltip content={<DayTooltip order={order} />} />
            {paid.map((a) => (
              <Bar key={a} dataKey={a} stackId="cost" fill={colorFor(order, a, theme)} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number; color: string }[];
  order: string[];
}

function DayTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const items = payload.filter((p) => p.value > 0).reverse();
  const total = items.reduce((s, p) => s + p.value, 0);
  return (
    <div className="card min-w-[10rem] px-3 py-2 text-xs text-ink">
      <p className="mb-1 font-medium">{shortDay(label)}</p>
      {items.map((p) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 capitalize">
            <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.dataKey}
          </span>
          <span className="tabular-nums">{usd(p.value)}</span>
        </p>
      ))}
      <p className="mt-1 flex justify-between gap-3 border-t border-line pt-1 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{usd(total)}</span>
      </p>
    </div>
  );
}
