import { useState, type FormEvent } from "react";
import { useCreateTask } from "../api/hooks";

// The field at the top of The Forge, where a new task is commissioned
export function CommissionForm() {
  const [task, setTask] = useState("");
  const create = useCreateTask();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = task.trim();
    if (!text) return;
    create.mutate(text, { onSuccess: () => setTask("") });
  };

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5">
      <label htmlFor="commission" className="font-display text-lg font-semibold text-ink">
        Commission a task
      </label>
      <p className="mb-3 text-sm text-muted">The supervisor picks which automatons work on it.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <textarea
          id="commission"
          rows={2}
          className="input min-h-[2.75rem] resize-y"
          placeholder="For example: Research the company behind my newest job and write a short cover letter"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
          }}
        />
        <button type="submit" className="btn-primary shrink-0 sm:self-start" disabled={!task.trim() || create.isPending}>
          {create.isPending ? "Sending…" : "Forge it"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {create.isError && <span className="text-bad">Could not send the task: {create.error.message}</span>}
        {create.isSuccess && !create.isPending && <span className="text-ok">Task #{create.data.id} is in the queue.</span>}
        {create.isIdle && <span>Ctrl + Enter sends.</span>}
      </p>
    </form>
  );
}
