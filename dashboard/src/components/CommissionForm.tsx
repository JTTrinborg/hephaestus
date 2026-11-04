import { useState, type FormEvent } from "react";
import { useCreateTask, useProjects } from "../api/hooks";

// The field where a new task is commissioned. On a project page the project is fixed,
// elsewhere it can be picked, and no project is the default
export function CommissionForm({ project }: { project?: { id: number; name: string } }) {
  const [task, setTask] = useState("");
  const [picked, setPicked] = useState("");
  const create = useCreateTask();
  const projects = useProjects();
  const projectId = project?.id ?? (picked ? Number(picked) : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = task.trim();
    if (!text) return;
    create.mutate({ task: text, project_id: projectId }, { onSuccess: () => setTask("") });
  };

  return (
    <form onSubmit={submit} className="card p-4 sm:p-5">
      <label htmlFor="commission" className="font-display text-lg font-semibold text-ink">
        Commission a task
      </label>
      <p className="mb-3 text-sm text-muted">
        The supervisor picks which automatons work on it.
        {projectId !== null && <> The agents see the project's goal and its earlier tasks.</>}
      </p>
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
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {project ? (
          <p className="text-sm">
            <span className="label mr-2">Project</span>
            <span className="font-medium">{project.name}</span>
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <label htmlFor="commission-project" className="label">Project</label>
            <select
              id="commission-project"
              className="input w-auto max-w-[16rem] py-1.5"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">None</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="text-xs text-muted" aria-live="polite">
          {create.isError && <span className="text-bad">Could not send the task: {create.error.message}</span>}
          {create.isSuccess && !create.isPending && <span className="text-ok">Task #{create.data.id} is in the queue.</span>}
          {create.isIdle && <span>Ctrl + Enter sends.</span>}
        </p>
      </div>
    </form>
  );
}
