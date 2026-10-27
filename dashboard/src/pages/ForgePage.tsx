import { useState } from "react";
import { Link } from "react-router-dom";
import { useAgentStatus, useLive, useTasks, useUsageDaily, useUsageSummary } from "../api/hooks";
import { AgentCard } from "../components/AgentCard";
import { CommissionForm } from "../components/CommissionForm";
import { CostTotals, PERIODS, periodDays, type Period } from "../components/CostTotals";
import { CostByAgentChart } from "../components/charts/CostByAgentChart";
import { CostLineChart } from "../components/charts/CostLineChart";
import { firstDay } from "../lib/format";
import { TaskTable } from "../components/TaskTable";
import { Empty, ErrorBox, Loading, Section } from "../components/ui";

// The front page: commission a task, see the automatons, the newest tasks and the cost
export function ForgePage() {
  const live = useLive();
  const tasks = useTasks(10);
  const agents = useAgentStatus(live);
  const summary = useUsageSummary(live);

  // The chart follows the cost tile that is picked. One day has no line to draw, so it shows cost per agent
  const [period, setPeriod] = useState<Period>("month");
  const days = periodDays(period);
  const byAgent = days === 1;
  // /usage/daily counts back from this moment, so one extra day is fetched and trimmed to the period
  const daily = useUsageDaily(Math.min(days + 1, 365), live);
  const inPeriod = (daily.data ?? []).filter((r) => r.day >= firstDay(days));
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();
  const chartTitle = byAgent
    ? `Cost per agent, ${periodLabel}`
    : period === "all_time"
      ? "Cost per day, all time (up to a year)"
      : `Cost per day, ${periodLabel}`;

  return (
    <>
      <h1 className="sr-only">The Forge</h1>
      <CommissionForm />

      <Section
        title="Automatons"
        action={
          <span className="text-xs text-muted" aria-live="polite">
            {live ? "A task is running · refreshing every 3 s" : "Refreshing every 30 s"}
          </span>
        }
      >
        {agents.isLoading ? (
          <Loading />
        ) : agents.error ? (
          <ErrorBox error={agents.error} />
        ) : agents.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {agents.data.map((a) => (
              <AgentCard key={a.name} agent={a} />
            ))}
          </div>
        ) : (
          <Empty>No active automatons.</Empty>
        )}
      </Section>

      <Section
        title="The forge"
        action={
          <Link to="/tasks" className="text-sm text-accent hover:underline">
            All tasks →
          </Link>
        }
      >
        {tasks.isLoading ? <Loading /> : tasks.error ? <ErrorBox error={tasks.error} /> : <TaskTable tasks={tasks.data ?? []} />}
      </Section>

      <Section
        title="Cost"
        action={
          <Link to="/usage" className="text-sm text-accent hover:underline">
            Usage details →
          </Link>
        }
      >
        {summary.error ? (
          <ErrorBox error={summary.error} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <CostTotals summary={summary.data} selected={period} onSelect={setPeriod} />
            <div className="card p-4">
              <p className="label mb-2">{chartTitle}</p>
              {daily.error ? (
                <ErrorBox error={daily.error} />
              ) : byAgent ? (
                <CostByAgentChart rows={inPeriod} height={180} label={chartTitle} />
              ) : (
                <CostLineChart
                  rows={inPeriod}
                  days={days}
                  height={180}
                  trimLeading={period === "all_time"}
                  label={chartTitle}
                />
              )}
            </div>
          </div>
        )}
      </Section>
    </>
  );
}
