import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageDay } from "../../api/types";
import { usd } from "../../lib/format";

// Sums the rows per agent, most expensive first
export function costByAgent(rows: UsageDay[]) {
  const byAgent = new Map<string, number>();
  for (const r of rows) byAgent.set(r.agent, (byAgent.get(r.agent) ?? 0) + r.cost_usd);
  return [...byAgent.entries()].map(([agent, cost]) => ({ agent, cost })).sort((a, b) => b.cost - a.cost);
}

// Horizontal bars, one per agent. The agent's name is on the axis, so colour is only a help.
// Without colorOf the bars use the accent through currentColor
export function CostByAgentChart({
  rows,
  height = 200,
  label,
  colorOf,
}: {
  rows: UsageDay[];
  height?: number;
  label: string;
  colorOf?: (agent: string) => string;
}) {
  const data = costByAgent(rows);
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted" style={{ height }}>
        No cost in this period.
      </div>
    );
  }
  return (
    <div className="text-accent" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v: number) => usd(v)} tickLine={false} axisLine={false} fontSize={12} />
          <YAxis type="category" dataKey="agent" tickLine={false} axisLine={false} width={88} fontSize={12} />
          <Tooltip content={<AgentTooltip />} />
          <Bar dataKey="cost" fill="currentColor" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
            {colorOf && data.map((d) => <Cell key={d.agent} fill={colorOf(d.agent)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { value: number }[];
}

function AgentTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs text-ink">
      <p className="font-medium capitalize">{label}</p>
      <p className="tabular-nums">{usd(payload[0].value)}</p>
    </div>
  );
}
