import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useApprovals, useDecideApproval } from "../api/hooks";
import type { Approval, EmailPayload } from "../api/types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusBadge } from "../components/StatusBadge";
import { Empty, ErrorBox, Loading, Section } from "../components/ui";
import { dateTime } from "../lib/format";

// A send_email payload has to, subject and body. Anything else is shown as JSON
export function asEmail(a: Approval): EmailPayload | null {
  const p = a.payload as Partial<EmailPayload>;
  return a.action === "send_email" && typeof p.to === "string" ? { to: p.to, subject: p.subject ?? "", body: p.body ?? "" } : null;
}

// What happened to an approval decided on this visit. A decided card leaves the list, so this says how it went
interface Outcome {
  approval: Approval;
  kind: "approved" | "failed" | "rejected" | "conflict";
  text: string;
}

// Actions agents proposed, which wait for me. Nothing is carried out until I approve it
export function ApprovalsPage() {
  const pending = useApprovals("pending");
  // GET /approvals without a status gives the newest 100 of all kinds. The decided ones are shown below
  const all = useApprovals();
  const decided = (all.data ?? []).filter((a) => a.status !== "pending");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const report = (o: Outcome) => setOutcomes((list) => [o, ...list.filter((x) => x.approval.id !== o.approval.id)]);
  // The API lists newest first. Oldest first here, so they are handled in the order they came
  const waiting = [...(pending.data ?? [])].reverse();

  return (
    <>
      <div className="mb-6 border-b border-line pb-3">
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted">
          Agents can propose actions, but code only carries them out after you approve. Checked every ten seconds.
        </p>
      </div>

      {outcomes.length > 0 && (
        <ul aria-live="polite" className="mb-6 space-y-2">
          {outcomes.map((o) => (
            <OutcomeNote key={o.approval.id} outcome={o} onDismiss={() => setOutcomes((l) => l.filter((x) => x !== o))} />
          ))}
        </ul>
      )}

      <Section title="Waiting for you">
        {pending.isLoading ? (
          <Loading />
        ) : pending.error ? (
          <ErrorBox error={pending.error} />
        ) : waiting.length ? (
          <ul className="space-y-4">
            {waiting.map((a) => (
              <PendingCard key={a.id} approval={a} onOutcome={report} />
            ))}
          </ul>
        ) : (
          <Empty>Nothing waits for approval.</Empty>
        )}
      </Section>

      <Section title="Decided">
        {all.isLoading ? (
          <Loading />
        ) : all.error ? (
          <ErrorBox error={all.error} />
        ) : decided.length ? (
          <>
            <ul className="card divide-y divide-line">
              {decided.map((a) => (
                <DecidedRow key={a.id} approval={a} />
              ))}
            </ul>
            {(all.data?.length ?? 0) >= 100 && (
              <p className="mt-2 text-xs text-muted">Showing the newest 100. Older ones are not listed by the API.</p>
            )}
          </>
        ) : (
          <Empty>Nothing decided yet.</Empty>
        )}
      </Section>
    </>
  );
}

// One decided approval: status, what it was, when, and the result. The email itself is folded away
function DecidedRow({ approval }: { approval: Approval }) {
  const email = asEmail(approval);
  return (
    <li className="space-y-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <StatusBadge status={approval.status === "pending" ? "new" : approval.status} />
        {/* Its own line on a phone, so the address is never squeezed beside the date */}
        <p className="min-w-0 basis-full text-sm sm:flex-1 sm:basis-0">
          {email ? (
            <>
              Email to <span className="font-medium [overflow-wrap:anywhere]">{email.to}</span>
              <span className="text-muted"> · </span>
              <span className="[overflow-wrap:anywhere]">{email.subject || <span className="italic text-muted">No subject</span>}</span>
            </>
          ) : (
            <>
              Action <code className="font-mono">{approval.action}</code>
            </>
          )}
          <span className="ml-2 text-muted">#{approval.id}</span>
        </p>
        <p className="text-xs text-muted">
          Decided {dateTime(approval.decided_at)} · <TaskLink taskId={approval.task_id} />
        </p>
      </div>
      {approval.result && (
        <p className={`break-words text-sm ${approval.status === "failed" ? "text-bad" : "text-ink/90"}`}>
          <span className="label mr-2">{approval.status === "failed" ? "Error" : "Result"}</span>
          {approval.result}
        </p>
      )}
      {approval.status === "rejected" && !approval.result && <p className="text-xs text-muted">Nothing was carried out.</p>}
      <details className="text-sm">
        <summary className="cursor-pointer text-accent">{email ? "Show email" : "Show details"}</summary>
        <div className="mt-2">{email ? <EmailView email={email} /> : <PayloadView payload={approval.payload} />}</div>
      </details>
    </li>
  );
}

const OUTCOME_STYLE: Record<Outcome["kind"], { icon: string; tone: string }> = {
  approved: { icon: "✓", tone: "border-ok/40 bg-ok/10 text-ok" },
  failed: { icon: "✕", tone: "border-bad/40 bg-bad/10 text-bad" },
  rejected: { icon: "–", tone: "border-line bg-sunken text-ink" },
  conflict: { icon: "!", tone: "border-warn/40 bg-warn/10 text-warn" },
};

function OutcomeNote({ outcome, onDismiss }: { outcome: Outcome; onDismiss: () => void }) {
  const s = OUTCOME_STYLE[outcome.kind];
  return (
    <li className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${s.tone}`}>
      <p className="min-w-0 break-words">
        <span aria-hidden="true" className="mr-2 font-bold">{s.icon}</span>
        {outcome.text}
      </p>
      <button type="button" onClick={onDismiss} className="shrink-0 text-xs underline opacity-80 hover:opacity-100">
        Dismiss
      </button>
    </li>
  );
}

// What approving will do, said plainly in the button's dialog. The address and action name are set in
// the plain font, since the heading font shows lowercase as small capitals and would change how they look
function describe(a: Approval) {
  const email = asEmail(a);
  const exact = "[overflow-wrap:anywhere] font-sans font-semibold normal-case tracking-normal";
  return email ? (
    <>
      Send this email to <span className={exact}>{email.to}</span>?
    </>
  ) : (
    <>
      Carry out <code className={`font-mono ${exact}`}>{a.action}</code>?
    </>
  );
}

function PendingCard({ approval, onOutcome }: { approval: Approval; onOutcome: (o: Outcome) => void }) {
  const email = asEmail(approval);
  const decide = useDecideApproval();
  const [confirming, setConfirming] = useState(false);
  const label = email ? `the email to ${email.to}` : `${approval.action} #${approval.id}`;

  const run = (decision: "approve" | "reject") =>
    decide.mutate(
      { id: approval.id, decision },
      {
        onSuccess: (r) => {
          setConfirming(false);
          const result = r.result ? ` ${r.result}.` : "";
          onOutcome(
            r.status === "approved"
              ? { approval, kind: "approved", text: `Approved ${label}.${result}` }
              : r.status === "failed"
                ? { approval, kind: "failed", text: `Approved ${label}, but carrying it out failed: ${r.result ?? "no reason given"}` }
                : { approval, kind: "rejected", text: `Rejected ${label}. Nothing was carried out.` },
          );
        },
        // 409: someone or something decided it already. Other errors stay in the dialog or on the card
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) {
            setConfirming(false);
            onOutcome({ approval, kind: "conflict", text: `${label} was not changed: ${e.message}` });
          }
        },
      },
    );

  return (
    <li className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-sunken px-4 py-2">
        <p className="text-sm font-medium">
          {email ? "Send an email" : <>Action <code className="font-mono">{approval.action}</code></>}
          <span className="ml-2 font-normal text-muted">#{approval.id}</span>
        </p>
        <p className="text-xs text-muted">
          Proposed {dateTime(approval.created_at)} · <TaskLink taskId={approval.task_id} />
        </p>
      </header>
      <div className="p-4">{email ? <EmailView email={email} /> : <PayloadView payload={approval.payload} />}</div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <button type="button" className="btn-primary" disabled={decide.isPending} onClick={() => setConfirming(true)}>
          Approve
        </button>
        <button type="button" className="btn-ghost" disabled={decide.isPending} onClick={() => run("reject")}>
          {decide.isPending && decide.variables?.decision === "reject" ? "Rejecting…" : "Reject"}
        </button>
        {decide.isError && !confirming && !(decide.error instanceof ApiError && decide.error.status === 409) && (
          <p role="alert" className="text-sm text-bad">Not decided: {decide.error.message}</p>
        )}
      </footer>

      <ConfirmDialog
        open={confirming}
        title={describe(approval)}
        confirmLabel={email ? "Yes, send it" : "Yes, carry it out"}
        pendingLabel={email ? "Sending…" : "Carrying out…"}
        tone="accent"
        pending={decide.isPending}
        error={decide.error}
        errorPrefix="Not approved:"
        onClose={() => {
          setConfirming(false);
          decide.reset();
        }}
        onConfirm={() => run("approve")}
      >
        {email && (
          <p className="break-words text-sm">
            <span className="text-muted">Subject: </span>
            {email.subject || <span className="italic text-muted">No subject</span>}
          </p>
        )}
        <p className="text-sm text-muted">This is carried out at once and can't be undone.</p>
      </ConfirmDialog>
    </li>
  );
}

// The whole email as it will be sent. Plain text, never rendered as HTML
export function EmailView({ email }: { email: EmailPayload }) {
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt className="label pt-0.5">To</dt>
        <dd className="break-all font-medium">{email.to}</dd>
        <dt className="label pt-0.5">Subject</dt>
        <dd className="break-words font-medium">{email.subject || <span className="italic text-muted">No subject</span>}</dd>
      </dl>
      <div>
        <p className="label mb-1">Body</p>
        <div className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 text-sm leading-relaxed">
          {email.body || <span className="italic text-muted">Empty</span>}
        </div>
      </div>
    </div>
  );
}

export function PayloadView({ payload }: { payload: Record<string, unknown> }) {
  return (
    <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 font-mono text-xs">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}

// Opens the task on the Tasks page, which expands that row
export function TaskLink({ taskId }: { taskId: number | null }) {
  if (taskId === null) return <span>Not from a task</span>;
  return (
    <Link to={`/tasks?task=${taskId}`} className="text-accent hover:underline">
      From task #{taskId}
    </Link>
  );
}
