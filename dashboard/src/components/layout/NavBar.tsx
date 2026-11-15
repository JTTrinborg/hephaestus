import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useApprovals } from "../../api/hooks";
import { Frieze } from "./Frieze";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { to: "/", label: "The Forge" },
  { to: "/automatons", label: "Automatons" },
  { to: "/tasks", label: "Tasks" },
  { to: "/approvals", label: "Approvals" },
  { to: "/guards", label: "Guards" },
  { to: "/projects", label: "Projects" },
  { to: "/usage", label: "Usage" },
  { to: "/profile", label: "My profile" },
  { to: "/settings", label: "Settings" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "text-accent bg-accent/10" : "text-muted hover:text-ink hover:bg-sunken"
  }`;

// The number of approvals waiting, as a small badge. Hidden when nothing waits
function PendingBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="min-w-[1.25rem] rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-5 text-accent-ink">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">
        , {count} pending approval{count === 1 ? "" : "s"}
      </span>
    </span>
  );
}

// Nine links don't fit beside the logo on a 1024 px screen, so the full nav starts at xl
export function NavBar() {
  const [open, setOpen] = useState(false);
  const pending = useApprovals("pending").data?.length ?? 0;

  const links = (onClick?: () => void) =>
    LINKS.map((l) => (
      <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass} onClick={onClick}>
        {l.label}
        {l.to === "/approvals" && <PendingBadge count={pending} />}
      </NavLink>
    ));

  return (
    <header className="sticky top-0 z-20 bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <NavLink to="/" className="flex shrink-0 items-center gap-3" onClick={() => setOpen(false)}>
          <img src="/logo.webp" alt="" className="h-10 w-10 rounded-full border border-line object-cover object-top" />
          <span className="font-display text-lg font-bold tracking-widest text-accent xl:sr-only 2xl:not-sr-only">HEPHAESTUS</span>
        </NavLink>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-0.5 xl:flex">
          {links()}
        </nav>
        <div className="ml-auto flex items-center gap-2 xl:ml-1">
          <ThemeToggle />
          <button
            type="button"
            className="btn-ghost px-3 xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
            {!open && <PendingBadge count={pending} />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="mx-auto flex max-w-6xl flex-col items-start gap-1 px-4 pb-3 xl:hidden">
          {links(() => setOpen(false))}
        </nav>
      )}
      <Frieze />
    </header>
  );
}
