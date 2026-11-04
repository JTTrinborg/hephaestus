import { useState, type FormEvent } from "react";
import { useSaveAgent } from "../api/hooks";
import type { Agent, Model } from "../api/types";
import { ErrorBox } from "./ui";

type Kind = Agent["kind"];
type QuestionType = NonNullable<Agent["question_type"]>;
interface OptionRow {
  id: number;
  name: string;
  description: string;
}

const EMPTY: Agent = {
  name: "",
  description: "",
  system_prompt: "",
  provider: "",
  tools: [],
  uses_profile: false,
  budget_usd: null,
  active: true,
  kind: "worker",
  question: null,
  question_type: null,
  options: {},
};

const KINDS: { value: Kind; name: string; note: string }[] = [
  { value: "worker", name: "Worker", note: "Writes text with a model and may use tools. For research, writing and summaries." },
  { value: "decider", name: "Decider", note: "Answers one typed question with Jev. For a yes or no, a choice or a score." },
];

export const QUESTION_TYPES: { value: QuestionType; name: string; options: string | null }[] = [
  { value: "choice", name: "Choice, picks one option", options: "Options" },
  { value: "score", name: "Score, rates on levels", options: "Levels" },
  { value: "noul", name: "Yes or no, with a probability", options: null },
];

let nextId = 0;
const row = (name = "", description = ""): OptionRow => ({ id: nextId++, name, description });

// Creates a new automaton, or edits one. Name and kind are its identity, so they can't change on edit
export function AgentForm({
  agent,
  knownTools,
  models,
  profileLocalOnly,
  onDone,
}: {
  agent: Agent | null;
  knownTools: string[];
  models: Model[];
  profileLocalOnly: boolean;
  onDone: () => void;
}) {
  const editing = agent !== null;
  const defaultModel = models.find((m) => m.name === "ollama")?.name ?? models[0]?.name ?? "";
  const [form, setForm] = useState<Agent>(agent ?? { ...EMPTY, provider: defaultModel });
  const [tools, setTools] = useState((agent?.tools ?? []).join(", "));
  const [budget, setBudget] = useState(agent?.budget_usd?.toString() ?? "");
  // Options as rows, so a name can be edited without losing its place. Two empty rows to start
  const [rows, setRows] = useState<OptionRow[]>(() => {
    const existing = Object.entries(agent?.options ?? {}).map(([n, d]) => row(n, d));
    return existing.length ? existing : [row(), row()];
  });
  const save = useSaveAgent();

  const set = <K extends keyof Agent>(key: K, value: Agent[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toolList = tools.split(",").map((t) => t.trim()).filter(Boolean);
  const isDecider = form.kind === "decider";
  const questionType = QUESTION_TYPES.find((q) => q.value === form.question_type);
  // "Options" or "Levels", or null for a yes or no question, which has none
  const optionsLabel = questionType?.options ?? null;
  const model = models.find((m) => m.name === form.provider);
  // A worker being edited may point at a model that is no longer in the registry
  const modelMissing = !isDecider && form.provider !== "" && !model;
  const names = rows.map((r) => r.name.trim()).filter(Boolean);
  const duplicate = optionsLabel ? names.find((n, i) => names.indexOf(n) !== i) : undefined;

  const toggleTool = (tool: string) => {
    const next = toolList.includes(tool) ? toolList.filter((t) => t !== tool) : [...toolList, tool];
    setTools(next.join(", "));
  };
  const setRow = (id: number, change: Partial<OptionRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  // A decider always uses Jev and has no tools, profile or budget. A worker has no question
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: Agent = isDecider
      ? {
          ...form,
          provider: "jev",
          tools: [],
          uses_profile: false,
          budget_usd: null,
          options:
            form.question_type === "noul"
              ? {}
              : Object.fromEntries(rows.filter((r) => r.name.trim()).map((r) => [r.name.trim(), r.description.trim()])),
        }
      : {
          ...form,
          tools: toolList,
          budget_usd: budget.trim() === "" ? null : Number(budget),
          question: null,
          question_type: null,
          options: {},
        };
    save.mutate(body, { onSuccess: onDone });
  };

  const id = (field: string) => `agent-${field}`;

  return (
    <form onSubmit={submit} className="card space-y-5 p-4 sm:p-5" aria-labelledby="agent-form-title">
      <h2 id="agent-form-title" className="text-lg font-semibold">
        {editing ? `Edit ${agent.name}` : "Forge a new automaton"}
      </h2>

      <fieldset>
        <legend className="label mb-2">Kind</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {KINDS.map((k) => {
            const checked = form.kind === k.value;
            return (
              <label
                key={k.value}
                className={`card flex gap-3 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  checked ? "border-accent bg-accent/5 ring-1 ring-accent" : editing ? "opacity-50" : "cursor-pointer hover:bg-sunken"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={checked}
                  disabled={editing}
                  onChange={() => set("kind", k.value)}
                  className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]"
                />
                <span>
                  <span className="block font-medium">{k.name}</span>
                  <span className="block text-sm text-muted">{k.note}</span>
                </span>
              </label>
            );
          })}
        </div>
        {editing && <p className="mt-1 text-xs text-muted">The kind can't be changed. Create a new agent instead.</p>}
      </fieldset>

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
            placeholder={isDecider ? "for example should_apply" : "for example translator"}
            aria-describedby={id("name-hint")}
          />
          <p id={id("name-hint")} className="mt-1 text-xs text-muted">
            {editing ? "The name is the key and can't be changed." : "Lowercase letters, digits and _, starting with a letter."}
          </p>
        </div>
        {!isDecider && (
          <div>
            <label htmlFor={id("model")} className="label">Model</label>
            <select
              id={id("model")}
              className="input mt-1"
              value={form.provider}
              onChange={(e) => set("provider", e.target.value)}
              required
            >
              {models.length === 0 && <option value="">No models. Add one in Settings</option>}
              {modelMissing && <option value={form.provider}>{form.provider} (not in the registry)</option>}
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} · {m.model} · {m.local ? "local" : "cloud"}
                  {m.key_set === false ? " · key missing" : ""}
                </option>
              ))}
            </select>
            {model?.key_set === false && (
              <p className="mt-1 text-xs text-warn">The key {model.key_env} is not set in .env, so this model will fail.</p>
            )}
            {modelMissing && <p className="mt-1 text-xs text-warn">This model is not in the registry. Pick another one.</p>}
          </div>
        )}
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

      {isDecider ? (
        <>
          <div>
            <label htmlFor={id("question")} className="label">Question</label>
            <textarea
              id={id("question")}
              rows={2}
              className="input mt-1"
              value={form.question ?? ""}
              onChange={(e) => set("question", e.target.value)}
              required
              placeholder="For example: Should I apply for this job, given my profile?"
              aria-describedby={id("question-hint")}
            />
            <p id={id("question-hint")} className="mt-1 text-xs text-muted">
              Jev answers this about the task and what the other agents found. It uses no model and no tools.
            </p>
          </div>
          <div>
            <label htmlFor={id("question-type")} className="label">Question type</label>
            <select
              id={id("question-type")}
              className="input mt-1 sm:w-auto"
              value={form.question_type ?? ""}
              onChange={(e) => set("question_type", (e.target.value || null) as Agent["question_type"])}
              required
            >
              <option value="" disabled>
                Pick a type
              </option>
              {QUESTION_TYPES.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>
          {optionsLabel && (
            <fieldset>
              <legend className="label">{optionsLabel}</legend>
              <p className="mb-2 text-xs text-muted">
                At least two. The name is the answer, the description tells Jev when to pick it.
              </p>
              <ul className="space-y-2">
                {rows.map((r, i) => (
                  <li key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <input
                      className="input font-mono sm:w-44"
                      value={r.name}
                      onChange={(e) => setRow(r.id, { name: e.target.value })}
                      placeholder={form.question_type === "score" ? `level ${i + 1}` : `option ${i + 1}`}
                      aria-label={`${optionsLabel} ${i + 1}, name`}
                      required
                    />
                    <input
                      className="input"
                      value={r.description}
                      onChange={(e) => setRow(r.id, { description: e.target.value })}
                      placeholder="When this is the answer"
                      aria-label={`${optionsLabel} ${i + 1}, description`}
                    />
                    <button
                      type="button"
                      className="btn-ghost shrink-0 px-3"
                      onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                      disabled={rows.length <= 2}
                      aria-label={`Remove ${optionsLabel.toLowerCase()} ${i + 1}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {duplicate && <p className="mt-2 text-xs text-bad">Two rows are named “{duplicate}”. Each name must be unique.</p>}
              <button type="button" className="btn-ghost mt-2 px-3 py-1.5" onClick={() => setRows((rs) => [...rs, row()])}>
                + Add {form.question_type === "score" ? "level" : "option"}
              </button>
            </fieldset>
          )}
        </>
      ) : (
        <>
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
              {form.uses_profile && model && !model.local && profileLocalOnly && (
                <p className="text-xs text-warn">
                  profile_local_only is on, so this cloud model will not get the profile until it is turned off in Settings.
                </p>
              )}
            </div>
          </div>
        </>
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

      {save.isError && <ErrorBox error={save.error} />}

      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        <button type="submit" className="btn-primary" disabled={save.isPending || !!duplicate}>
          {save.isPending ? "Saving…" : editing ? "Save changes" : "Forge automaton"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
