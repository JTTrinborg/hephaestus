import { useState } from "react";
import { useLive, useUsageDaily, useUsageSummary } from "../api/hooks";
import type { UsageDay } from "../api/types";
import { CostTotals } from "../components/CostTotals";
import { CostByAgentChart } from "../components/charts/CostByAgentChart";
import { StackedCostChart } from "../components/charts/StackedCostChart";
import { ErrorBox, ExternalLink, Loading, Section } from "../components/ui";
import { firstDay, tokens, usd } from "../lib/format";
import { colorFor, seriesOrder, useThemeName } from "../lib/series";
import { LANGFUSE_URL } from "../lib/theme";

const RANGES = [7, 30, 90];

// Calls, tokens and cost per agent for the period, most expensive first
function perAgent(rows: UsageDay[]) {
  const map = new Map<string, { agent: string; calls: number; input: number; output: number; cost: number }>();
  for (const r of rows) {
    const a = map.get(r.agent) ?? { agent: r.agent, calls: 0, input: 0, output: 0, cost: 0 };
    a.calls += r.calls;
    a.input += r.input_tokens;
    a.output += r.output_tokens;
    a.cost += r.cost_usd;
    map.set(r.agent, a);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost || b.calls - a.calls);
}

// Cost per agent and per day as charts, a table with the numbers, and the four totals
export function UsagePage() {
  const live = useLive();
  const theme = useThemeName();
  const [days, setDays] = useState(30);
  const summary = useUsageSummary(live);
  const daily = useUsageDaily(days + 1, live);

  const rows = (daily.data ?? []).filter((r) => r.day >= firstDay(days));
  const order = seriesOrder(rows.map((r) => r.agent));
  const table = perAgent(rows);
  const total = table.reduce(
    (s, a) => ({ calls: s.calls + a.calls, input: s.input + a.input, output: s.output + a.output, cost: s.cost + a.cost }),
    { calls: 0, input: 0, output: 0, cost: 0 },
  );

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-2xl font-semibold">Usage</h1>
          <p className="text-sm text-muted">
            Every model call is costed in Postgres. Local models cost $0. <ExternalLink href={LANGFUSE_URL}>Tokens and latency in Langfuse</ExternalLink>
          </p>
        </div>
      </div>

      {summary.error ? <ErrorBox error={summary.error} /> : <CostTotals summary={summary.data} />}

      <div role="group" aria-label="Period for the charts" className="mt-8 flex flex-wrap items-center gap-2">
        <span className="label mr-1">Charts show</span>
        {RANGES.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === days}
            onClick={() => setDays(d)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              d === days ? "border-accent bg-accent/10 font-medium text-accent" : "border-line text-muted hover:bg-sunken hover:text-ink"
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {daily.isLoading ? (
        <Loading />
      ) : daily.error ? (
        <div className="mt-4">
          <ErrorBox error={daily.error} />
        </div>
      ) : (
        <>
          <Section title="Cost per day">
            <div className="card p-4">
              <StackedCostChart rows={rows} days={days} order={order} />
            </div>
          </Section>

          <Section title="Cost per agent">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="card p-4">
                <CostByAgentChart
                  rows={rows}
                  height={Math.max(160, table.length * 36)}
                  label={`Cost per agent, last ${days} days`}
                  colorOf={(a) => colorFor(order, a, theme)}
                />
              </div>
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Calls, tokens and cost per agent, last {days} days</caption>
                  <thead className="bg-sunken text-left">
                    <tr>
                      <th scope="col" className="label px-3 py-2">Agent</th>
                      <th scope="col" className="label px-3 py-2 text-right">Calls</th>
                      <th scope="col" className="label px-3 py-2 text-right">Tokens in</th>
                      <th scope="col" className="label px-3 py-2 text-right">Tokens out</th>
                      <th scope="col" className="label px-3 py-2 text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {table.map((a) => (
                      <tr key={a.agent}>
                        <th scope="row" className="px-3 py-2 text-left font-medium capitalize">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colorFor(order, a.agent, theme) }} />
                            {a.agent}
                          </span>
                        </th>
                        <td className="px-3 py-2 text-right tabular-nums">{a.calls}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{tokens(a.input)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{tokens(a.output)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{usd(a.cost)}</td>
                      </tr>
                    ))}
                    {table.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-muted">No model calls in this period.</td>
                      </tr>
                    )}
                  </tbody>
                  {table.length > 0 && (
                    <tfoot className="border-t-2 border-line font-semibold">
                      <tr>
                        <th scope="row" className="px-3 py-2 text-left">Total</th>
                        <td className="px-3 py-2 text-right tabular-nums">{total.calls}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{tokens(total.input)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{tokens(total.output)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{usd(total.cost)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
