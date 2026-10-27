import { useState, type FormEvent } from "react";
import { useSaveAgent } from "../api/hooks";
import type { Agent } from "../api/types";
import { ErrorBox } from "./ui";

const EMPTY: Agent = {
  name: "",
  description: "",
  system_prompt: "",
  provider: "ollama",
  tools: [],
  uses_profile: false,
  budget_usd: null,
  active: true,
};

// Creates a new automaton, or edits one. The name is the key, so it can't change on edit
export function AgentForm({
  agent,
  knownTools,
  profileLocalOnly,
  onDone,
}: {
  agent: Agent | null;
  knownTools: string[];
  profileLocalOnly: boolean;
  onDone: () => void;
}) {
  const editing = agent !== null;
  const [form, setForm] = useState<Agent>(agent ?? EMPTY);
  const [tools, setTools] = useState((agent?.tools ?? []).join(", "));
  const [budget, setBudget] = useState(agent?.budget_usd?.toString() ?? "");
  const save = useSaveAgent();

  const set = <K extends keyof Agent>(key: K, value: Agent[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toolList = tools.split(",").map((t) => t.trim()).filter(Boolean);

  const toggleTool = (tool: string) => {
    const next = toolList.includes(tool) ? toolList.filter((t) => t !== tool) : [...toolList, tool];
    setTools(next.join(", "));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { ...form, tools: toolList, budget_usd: budget.trim() === "" ? null : Number(budget) },
      { onSuccess: onDone },
    );
  };

  const id = (field: string) => `agent-${field}`;

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5" aria-labelledby="agent-form-title">
      <h2 id="agent-form-title" className="text-lg font-semibold">
        {editing ? `Edit ${agent.name}` : "Forge a new automaton"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("name")} className="label">Name</label>
          <input
            id={id("name")}
            className="input mt-1 font-mono disabled:opacity-60"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={editing}
            required
            pattern="[a-z][a-z0-9_]{1,30}"
            placeholder="for example translator"
            aria-describedby={id("name-hint")}
          />
          <p id={id("name-hint")} className="mt-1 text-xs text-muted">
            {editing ? "The name is the key and can't be changed." : "Lowercase letters, digits and _, starting with a letter."}
          </p>
        </div>
        <div>
          <label htmlFor={id("provider")} className="label">Model provider</label>
          <select
            id={id("provider")}
            className="input mt-1"
            value={form.provider}
            onChange={(e) => set("provider", e.target.value as Agent["provider"])}
          >
            <option value="ollama">Ollama, local (Qwen3)</option>
            <option value="anthropic">Anthropic, cloud (Claude)</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={id("description")} className="label">Description</label>
        <textarea
          id={id("description")}
          rows={2}
          className="input mt-1"
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          required
          aria-describedby={id("description-hint")}
        />
        <p id={id("description-hint")} className="mt-1 text-xs text-muted">
          The supervisor reads this to decide when to use the agent. Say what it does and what it needs first.
        </p>
      </div>

      <div>
        <label htmlFor={id("prompt")} className="label">Instructions (system prompt)</label>
        <textarea
          id={id("prompt")}
          rows={6}
          className="input mt-1 font-mono text-xs leading-relaxed"
          value={form.system_prompt}
          onChange={(e) => set("system_prompt", e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor={id("tools")} className="label">Tools</label>
        <input
          id={id("tools")}
          className="input mt-1 font-mono"
          value={tools}
          onChange={(e) => setTools(e.target.value)}
          placeholder="none"
          aria-describedby={id("tools-hint")}
        />
        {knownTools.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">In use by other agents:</span>
            {knownTools.map((t) => {
              const on = toolList.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTool(t)}
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-xs transition-colors ${
                    on ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:bg-sunken"
                  }`}
                >
                  {on ? "✓ " : "+ "}
                  {t}
                </button>
              );
            })}
          </div>
        )}
        <p id={id("tools-hint")} className="mt-1 text-xs text-muted">
          Separate with commas. Only tools in the tool registry are accepted.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={id("budget")} className="label">Monthly budget, USD</label>
          <input
            id={id("budget")}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="input mt-1"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No limit"
          />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:pt-6">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[rgb(var(--accent))]"
              checked={form.uses_profile}
              onChange={(e) => set("uses_profile", e.target.checked)}
            />
            May read my profile
          </label>
          {form.uses_profile && form.provider === "anthropic" && profileLocalOnly && (
            <p className="text-xs text-warn">
              profile_local_only is on, so this cloud agent will not get the profile until it is turned off in Settings.
            </p>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[rgb(var(--accent))]"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Active, the supervisor can pick it
          </label>
        </div>
      </div>

      {save.isError && <ErrorBox error={save.error} />}

      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? "Saving…" : editing ? "Save changes" : "Forge automaton"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
