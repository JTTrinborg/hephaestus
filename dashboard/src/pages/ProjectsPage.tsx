import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useCreateProject, useProjects } from "../api/hooks";
import type { Project } from "../api/types";
import { DeleteButton } from "../components/DeleteButton";
import { Empty, ErrorBox, Loading } from "../components/ui";
import { dateTime, usd } from "../lib/format";

// All projects with their tasks and cost, and a form to start a new one
export function ProjectsPage() {
  const projects = useProjects();

  return (
    <>
      <div className="mb-6 border-b border-line pb-3">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <p className="text-sm text-muted">
          A project groups tasks with one goal. Agents in a project see its goal and what was done in its earlier tasks.
        </p>
      </div>

      <NewProjectForm />

      <div className="mt-8">
        {projects.isLoading ? (
          <Loading />
        ) : projects.error ? (
          <ErrorBox error={projects.error} />
        ) : projects.data?.length ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {projects.data.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </ul>
        ) : (
          <Empty>No projects yet. Start the first one above.</Empty>
        )}
      </div>
    </>
  );
}

function NewProjectForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useCreateProject();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), description: description.trim() },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="card space-y-3 p-4 sm:p-5" aria-labelledby="new-project">
      <h2 id="new-project" className="text-lg font-semibold">
        Start a project
      </h2>
      <div>
        <label htmlFor="project-name" className="label">Name</label>
        <input
          id="project-name"
          className="input mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="For example: Job search Brisbane"
          required
        />
      </div>
      <div>
        <label htmlFor="project-goal" className="label">Goal</label>
        <textarea
          id="project-goal"
          rows={2}
          className="input mt-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What the project should achieve. The agents read this"
        />
      </div>
      {create.isError && <ErrorBox error={create.error} />}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={!name.trim() || create.isPending}>
          {create.isPending ? "Creating…" : "Create project"}
        </button>
        <span className="text-sm" aria-live="polite">
          {create.isSuccess && (
            <span className="text-ok">
              ✓ Created.{" "}
              <Link to={`/projects/${create.data.id}`} className="text-accent hover:underline">
                Open it →
              </Link>
            </span>
          )}
        </span>
      </div>
    </form>
  );
}

// What happens to a project's tasks when it is deleted, said in the confirm dialog
export function deleteConsequence(tasks: number): string {
  if (tasks === 0) return "It has no tasks.";
  return tasks === 1 ? "Its one task stays, without a project." : `Its ${tasks} tasks stay, without a project.`;
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <li className="card flex flex-col gap-3 p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold">
          <Link to={`/projects/${project.id}`} className="break-words hover:text-accent hover:underline">
            {project.name}
          </Link>
        </h2>
        {!project.active && (
          <span className="rounded-full border border-idle/30 px-2.5 py-0.5 text-xs text-idle">Inactive</span>
        )}
      </header>
      <p className="text-sm text-ink/90">{project.description || <span className="italic text-muted">No goal written</span>}</p>
      <dl className="grid grid-cols-3 gap-2 border-t border-line pt-3 text-sm">
        <div>
          <dt className="label">Tasks</dt>
          <dd className="tabular-nums">{project.tasks}</dd>
        </div>
        <div>
          <dt className="label">Cost</dt>
          <dd className="tabular-nums">{usd(project.cost_usd)}</dd>
        </div>
        <div>
          <dt className="label">Started</dt>
          <dd>{dateTime(project.created_at)}</dd>
        </div>
      </dl>
      <div className="mt-auto flex flex-wrap gap-2">
        <Link to={`/projects/${project.id}`} className="btn-ghost px-3 py-1.5">
          Open
        </Link>
        <DeleteButton
          path={`/projects/${project.id}`}
          what={<>the project <strong>{project.name}</strong></>}
          consequence={deleteConsequence(project.tasks)}
          invalidate={[["projects"], ["tasks"]]}
        />
      </div>
    </li>
  );
}
