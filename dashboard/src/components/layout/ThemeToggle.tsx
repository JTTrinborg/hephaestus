import { useTheme } from "../../lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "marble" ? "Forge" : "Marble";
  return (
    <button type="button" className="btn-ghost px-3" onClick={toggle} title={`Switch to the ${next} theme`}>
      <span aria-hidden="true">{theme === "marble" ? "☾" : "☀"}</span>
      <span className="hidden sm:inline">{next}</span>
      <span className="sr-only sm:hidden">Switch to the {next} theme</span>
    </button>
  );
}
