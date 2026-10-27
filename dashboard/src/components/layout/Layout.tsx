import { Outlet } from "react-router-dom";
import { NavBar } from "./NavBar";

export function Layout() {
  return (
    // On wide screens the page is padded so the columns stand beside the content, not on it
    <div className="min-h-screen xl:px-24">
      {/* Columns framing the page, as in the sketch. Only on wide screens, where there is room for them */}
      <div aria-hidden="true" className="column left-6 hidden xl:block" />
      <div aria-hidden="true" className="column right-6 hidden xl:block" />
      <NavBar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">
        <Outlet />
      </main>
    </div>
  );
}
