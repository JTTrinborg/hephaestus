import { useState } from "react";
import { useRoutines, useSetSetting, useSettings, useUpdateRoutine } from "../api/hooks";
import type { Routine, Settings } from "../api/types";
import { Toggle } from "../components/Toggle";
import { Empty, ErrorBox, Loading, Section } from "../components/ui";

// The choices, with the measurements from the supervisor eval in the README
const PROVIDERS: { value: Settings["supervisor_provider"]; name: string; note: string }[] = [
  { value: "anthropic", name: "Claude Haiku", note: "Cloud. 30 of 30 right, twice. About $0.004 per 30 decisions" },
  { value: "ollama", name: "Qwen3 14B", note: "Local and free. 26 to 29 of 30, slower" },
  { value: "jev", name: "Jev", note: "Fastest and cheapest, 26 of 30. Can skip steps an agent depends on" },
];

// Supervisor model, profile_local_only and the routines with time of day and active
export function SettingsPage() {
  const settings = useSettings();
  const set = useSetSetting();
  const routines = useRoutines();

  return (
    <>
      <div className="mb-6 border-b border-line pb-3">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">Stored in Postgres and used from the next task, without a restart.</p>
      </div>

      {settings.isLoading ? (
        <Loading />
      ) : settings.error ? (
        <ErrorBox error={settings.error} />
      ) : settings.data ? (
        <>
          <Section title="Supervisor model">
            <fieldset className="grid gap-3 md:grid-cols-3" disabled={set.isPending}>
              <legend className="mb-3 text-sm text-muted">The model that picks which agent works next.</legend>
              {PROVIDERS.map((p) => {
                const checked = settings.data!.supervisor_provider === p.value;
                return (
                  <label
                    key={p.value}
                    className={`card flex cursor-pointer gap-3 p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                      checked ? "border-accent bg-accent/5 ring-1 ring-accent" : "hover:bg-sunken"
                    }`}
                  >
                    <input
                      type="radio"
                      name="supervisor_provider"
                      value={p.value}
                      checked={checked}
                      onChange={() => set.mutate({ key: "supervisor_provider", value: p.value })}
                      className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]"
                    />
                    <span>
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {p.name}
                        {checked && <span className="text-xs font-normal text-accent">In use</span>}
                      </span>
                      <span className="mt-1 block text-sm text-muted">{p.note}</span>
                      <code className="mt-1 block font-mono text-xs text-muted">{p.value}</code>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </Section>

          <Section title="Profile privacy">
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  Profile to local models only <code className="ml-1 font-mono text-xs text-muted">profile_local_only</code>
                </p>
                <p className="text-sm text-muted">
                  {settings.data.profile_local_only === "true"
                    ? "On: only local models get my profile, even if a cloud agent may read it."
                    : "Off: each agent's own “may read my profile” decides, also for cloud models."}
                </p>
              </div>
              <Toggle
                checked={settings.data.profile_local_only === "true"}
                label="Profile to local models only"
                onText="On"
                offText="Off"
                disabled={set.isPending}
                onChange={(on) => set.mutate({ key: "profile_local_only", value: on ? "true" : "false" })}
              />
            </div>
          </Section>

          <p className="mt-3 min-h-[1.25rem] text-sm" aria-live="polite">
            {set.isPending && <span className="text-muted">Saving…</span>}
            {set.isSuccess && <span className="text-ok">✓ Saved</span>}
          </p>
          {set.isError && <ErrorBox error={set.error} />}
        </>
      ) : null}

      <Section title="Routines">
        <p className="mb-3 text-sm text-muted">
          Fixed jobs with a time of day, in Brisbane time. If the PC was off at that time, a routine runs at the first start after.
        </p>
        {routines.isLoading ? (
          <Loading />
        ) : routines.error ? (
          <ErrorBox error={routines.error} />
        ) : routines.data?.length ? (
          <ul className="space-y-3">
            {routines.data.map((r) => (
              <RoutineRow key={r.name} routine={r} />
            ))}
          </ul>
        ) : (
          <Empty>No routines.</Empty>
        )}
      </Section>
    </>
  );
}

function RoutineRow({ routine }: { routine: Routine }) {
  const update = useUpdateRoutine();
  const stored = routine.daily_at.slice(0, 5); // "06:00:00" becomes "06:00"
  const [time, setTime] = useState(stored);
  const changed = time !== stored && time !== "";
  const id = `routine-${routine.name}`;

  return (
    <li className={`card p-4 ${routine.active ? "" : "opacity-75"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-sans text-base font-semibold tracking-normal">{routine.name}</h3>
          <p className="truncate text-xs text-muted" title={routine.target}>
            {routine.kind} · {routine.target}
          </p>
          <p className="mt-1 text-xs text-muted">Last run: {routine.last_run ?? "never"}</p>
        </div>
        <Toggle
          checked={routine.active}
          label={`${routine.name} active`}
          disabled={update.isPending}
          onChange={(active) => update.mutate({ name: routine.name, active })}
        />
      </div>
      <form
        className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) update.mutate({ name: routine.name, daily_at: time });
        }}
      >
        <div>
          <label htmlFor={id} className="label">Time of day</label>
          <input id={id} type="time" className="input mt-1 w-32" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <button type="submit" className="btn-ghost" disabled={!changed || update.isPending}>
          Save time
        </button>
        {changed && (
          <button type="button" className="text-sm text-muted hover:text-ink" onClick={() => setTime(stored)}>
            Undo
          </button>
        )}
        <span className="text-sm" aria-live="polite">
          {update.isSuccess && !changed && <span className="text-ok">✓ Saved</span>}
        </span>
      </form>
      {update.isError && (
        <div className="mt-3">
          <ErrorBox error={update.error} />
        </div>
      )}
    </li>
  );
}
