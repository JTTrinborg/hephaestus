import { Link, useNavigate, useParams } from "react-router-dom";
import { useProjects, useTasks } from "../api/hooks";
import { CommissionForm } from "../components/CommissionForm";
import { DeleteButton } from "../components/DeleteButton";
import { TaskTable } from "../components/TaskTable";
import { Empty, ErrorBox, Loading, Section } from "../components/ui";
import { dateTime, usd } from "../lib/format";
import { deleteConsequence } from "./ProjectsPage";

// One project: its goal, a field to commission a task in it, and its tasks.
// The API has no single-project endpoint, so the project is found in GET /projects
export function ProjectPage() {
  const raw = useParams().id;
  const id = Number(raw);
  const navigate = useNavigate();
  const projects = useProjects();
  const tasks = useTasks(200, id);
  const project = projects.data?.find((p) => p.id === id);

  if (projects.isLoading) return <Loading />;
  if (projects.error) return <ErrorBox error={projects.error} />;
  if (!project) {
    return (
      <>
        <BackLink />
        <Empty>No project with id {raw}.</Empty>
      </>
    );
  }

  return (
    <>
      <BackLink />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 text-sm text-ink/90">{project.description || <span className="italic text-muted">No goal written</span>}</p>
          <p className="mt-2 text-xs text-muted">
            {project.tasks} task{project.tasks === 1 ? "" : "s"} · {usd(project.cost_usd)} · started {dateTime(project.created_at)}
          </p>
        </div>
        <DeleteButton
          label="Delete project"
          path={`/projects/${project.id}`}
          what={<>the project <strong>{project.name}</strong></>}
          consequence={deleteConsequence(project.tasks)}
          invalidate={[["projects"], ["tasks"]]}
          onDeleted={() => navigate("/projects")}
        />
      </div>

      <CommissionForm project={{ id: project.id, name: project.name }} />

      <Section title="Tasks in this project">
        {tasks.isLoading ? (
          <Loading />
        ) : tasks.error ? (
          <ErrorBox error={tasks.error} />
        ) : (
          <TaskTable tasks={tasks.data ?? []} empty="No tasks in this project yet. Commission one above." showProject={false} />
        )}
      </Section>
    </>
  );
}

function BackLink() {
  return (
    <Link to="/projects" className="mb-3 inline-block text-sm text-accent hover:underline">
      ← All projects
    </Link>
  );
}
