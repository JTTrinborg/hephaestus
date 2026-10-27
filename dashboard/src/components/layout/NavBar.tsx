import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Frieze } from "./Frieze";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { to: "/", label: "The Forge" },
  { to: "/automatons", label: "Automatons" },
  { to: "/tasks", label: "Tasks" },
  { to: "/usage", label: "Usage" },
  { to: "/profile", label: "My profile" },
  { to: "/settings", label: "Settings" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "text-accent bg-accent/10" : "text-muted hover:text-ink hover:bg-sunken"
  }`;

export function NavBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <NavLink to="/" className="flex shrink-0 items-center gap-3" onClick={() => setOpen(false)}>
          <img src="/logo.webp" alt="" className="h-10 w-10 rounded-full border border-line object-cover object-top" />
          <span className="font-display text-lg font-bold tracking-widest text-accent">HEPHAESTUS</span>
        </NavLink>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <ThemeToggle />
          <button
            type="button"
            className="btn-ghost px-3 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 pb-3 lg:hidden">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={linkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
      <Frieze />
    </header>
  );
}
