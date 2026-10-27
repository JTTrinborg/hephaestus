import type { ReactNode } from "react";

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-line pb-2">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="rounded-md border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">
      <strong className="font-semibold">Error: </strong>
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center text-sm text-muted">Loading…</p>;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sm text-accent underline-offset-2 hover:underline">
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}
