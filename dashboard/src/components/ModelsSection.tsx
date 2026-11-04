import { useState, type FormEvent } from "react";
import { useModels, useSaveModel } from "../api/hooks";
import type { Model } from "../api/types";
import { usd } from "../lib/format";
import { DeleteButton } from "./DeleteButton";
import { Empty, ErrorBox, Loading, Section } from "./ui";

const KINDS: { value: Model["kind"]; name: string }[] = [
  { value: "anthropic", name: "Anthropic (Claude)" },
  { value: "ollama", name: "Ollama" },
  { value: "openai_compatible", name: "OpenAI compatible" },
];

const EMPTY: Model = {
  name: "",
  kind: "ollama",
  model: "",
  base_url: null,
  key_env: null,
  local: true,
  price_in: 0,
  price_out: 0,
};

// The model registry: list, add, edit and delete. Keys are never entered here, only the name of the variable
export function ModelsSection() {
  const models = useModels();
  const [editing, setEditing] = useState<null | "new" | Model>(null);

  return (
    <Section
      title="Models"
      action={
        !editing && (
          <button type="button" className="btn-primary px-3 py-1.5" onClick={() => setEditing("new")}>
            + Add model
          </button>
        )
      }
    >
      <KeyNote />
      {editing && (
        <div className="mb-4">
          <ModelForm
            key={editing === "new" ? "new" : editing.name}
            model={editing === "new" ? null : editing}
            onDone={() => setEditing(null)}
          />
        </div>
      )}
      {models.isLoading ? (
        <Loading />
      ) : models.error ? (
        <ErrorBox error={models.error} />
      ) : models.data?.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {models.data.map((m) => (
            <ModelCard key={m.name} model={m} onEdit={() => setEditing(m)} />
          ))}
        </ul>
      ) : (
        <Empty>No models in the registry.</Empty>
      )}
    </Section>
  );
}

function KeyNote() {
  return (
    <div role="note" className="mb-4 rounded-md border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
      <p className="font-semibold">API keys are never entered here.</p>
      <p className="mt-1">
        Put the key itself in <code className="font-mono">.env</code>, and enter only the <strong>name</strong> of the variable
        here, for example <code className="font-mono">ANTHROPIC_API_KEY</code>. Restart the API and worker after changing{" "}
        <code className="font-mono">.env</code>.
      </p>
    </div>
  );
}

function ModelCard({ model, onEdit }: { model: Model; onEdit: () => void }) {
  return (
    <li className="card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono text-base font-semibold tracking-normal">{model.name}</h3>
        <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{model.local ? "Local" : "Cloud"}</span>
      </header>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="min-w-0">
          <dt className="label">Kind</dt>
          <dd>{KINDS.find((k) => k.value === model.kind)?.name ?? model.kind}</dd>
        </div>
        <div className="min-w-0">
          <dt className="label">Model</dt>
          <dd className="break-words font-mono text-xs">{model.model}</dd>
        </div>
        {model.base_url && (
          <div className="col-span-2 min-w-0">
            <dt className="label">Base URL</dt>
            <dd className="break-all font-mono text-xs">{model.base_url}</dd>
          </div>
        )}
        <div className="min-w-0">
          <dt className="label">Key variable</dt>
          <dd className="flex flex-wrap items-center gap-2">
            {model.key_env ? (
              <>
                <code className="break-all font-mono text-xs">{model.key_env}</code>
                <KeyBadge set={model.key_set !== false} />
              </>
            ) : (
              <span className="text-muted">None needed</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="label">Price per 1M tokens</dt>
          <dd className="tabular-nums">
            {usd(model.price_in)} in · {usd(model.price_out)} out
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5" onClick={onEdit}>
          Edit
        </button>
        <DeleteButton
          path={`/models/${encodeURIComponent(model.name)}`}
          what={<>the model <strong>{model.name}</strong></>}
          consequence="Agents and the supervisor can't use it any more. The API refuses while any of them still does."
          invalidate={[["models"], ["keys"]]}
        />
      </div>
    </li>
  );
}

export function KeyBadge({ set }: { set: boolean }) {
  return set ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 text-xs font-medium text-ok">
      <span aria-hidden="true">✓</span> Set
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border border-bad/30 bg-bad/10 px-2 py-0.5 text-xs font-medium text-bad">
      <span aria-hidden="true">✕</span> Missing
    </span>
  );
}

function ModelForm({ model, onDone }: { model: Model | null; onDone: () => void }) {
  const editing = model !== null;
  const [form, setForm] = useState<Model>(model ?? EMPTY);
  const [priceIn, setPriceIn] = useState(String(model?.price_in ?? 0));
  const [priceOut, setPriceOut] = useState(String(model?.price_out ?? 0));
  const save = useSaveModel();
  const set = <K extends keyof Model>(key: K, value: Model[K]) => setForm((f) => ({ ...f, [key]: value }));

  // jev is reserved for the decision model. The API should refuse it, but its check is not active yet
  const reserved = form.name.trim() === "jev";
  const needsUrl = form.kind === "openai_compatible";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        ...form,
        base_url: form.base_url?.trim() || null,
        key_env: form.key_env?.trim() || null,
        price_in: Number(priceIn) || 0,
        price_out: Number(priceOut) || 0,
      },
      { onSuccess: onDone },
    );
  };

  const id = (f: string) => `model-${f}`;

  return (
    <form onSubmit={submit} className="card space-y-4 p-4 sm:p-5" aria-labelledby="model-form-title">
      <h3 id="model-form-title" className="text-lg font-semibold">
        {editing ? `Edit ${model.name}` : "Add a model"}
      </h3>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={id("name")} className="label">Name</label>
          <input
            id={id("name")}
            className="input mt-1 font-mono disabled:opacity-60"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={editing}
            required
            pattern="[a-z][a-z0-9_\-]{1,30}"
            placeholder="for example haiku"
            aria-invalid={reserved}
            aria-describedby={id("name-hint")}
          />
          <p id={id("name-hint")} className={`mt-1 text-xs ${reserved ? "text-bad" : "text-muted"}`}>
            {reserved
              ? "jev is reserved for the decision model."
              : editing
                ? "The name is the key. Agents use it as their model."
                : "Lowercase, digits, _ and -. Agents pick the model by this name."}
          </p>
        </div>
        <div>
          <label htmlFor={id("kind")} className="label">Kind</label>
          <select id={id("kind")} className="input mt-1" value={form.kind} onChange={(e) => set("kind", e.target.value as Model["kind"])}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("model")} className="label">Model id</label>
          <input
            id={id("model")}
            className="input mt-1 font-mono"
            value={form.model}
            onChange={(e) => set("model", e.target.value)}
            required
            placeholder="for example qwen3:14b"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("url")} className="label">Base URL {needsUrl ? "(required)" : "(optional)"}</label>
          <input
            id={id("url")}
            type="url"
            className="input mt-1 font-mono"
            value={form.base_url ?? ""}
            onChange={(e) => set("base_url", e.target.value)}
            required={needsUrl}
            placeholder="http://host.docker.internal:11434/v1"
          />
        </div>
        <div>
          <label htmlFor={id("key")} className="label">Name of the key variable in .env</label>
          <input
            id={id("key")}
            className="input mt-1 font-mono"
            value={form.key_env ?? ""}
            onChange={(e) => set("key_env", e.target.value.toUpperCase())}
            pattern="[A-Z][A-Z0-9_]*"
            placeholder="for example ANTHROPIC_API_KEY, or empty"
            autoComplete="off"
            spellCheck={false}
            aria-describedby={id("key-hint")}
          />
          <p id={id("key-hint")} className="mt-1 text-xs text-muted">
            Only the name, never the key. Uppercase letters, digits and _. Empty for local models.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={id("in")} className="label">Price in, USD per 1M tokens</label>
          <input id={id("in")} type="number" min="0" step="0.0001" inputMode="decimal" className="input mt-1" value={priceIn} onChange={(e) => setPriceIn(e.target.value)} />
        </div>
        <div>
          <label htmlFor={id("out")} className="label">Price out, USD per 1M tokens</label>
          <input id={id("out")} type="number" min="0" step="0.0001" inputMode="decimal" className="input mt-1" value={priceOut} onChange={(e) => setPriceOut(e.target.value)} />
        </div>
        <label className="inline-flex items-center gap-2 text-sm sm:pt-6">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--accent))]" checked={form.local} onChange={(e) => set("local", e.target.checked)} />
          Runs locally, may get the profile when profile_local_only is on
        </label>
      </div>

      {save.isError && <ErrorBox error={save.error} />}

      <div className="flex flex-wrap gap-3 border-t border-line pt-4">
        <button type="submit" className="btn-primary" disabled={save.isPending || reserved}>
          {save.isPending ? "Saving…" : editing ? "Save changes" : "Add model"}
        </button>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
