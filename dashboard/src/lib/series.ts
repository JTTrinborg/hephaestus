import { useEffect, useState } from "react";
import type { Theme } from "./theme";

// Eight categorical colours, checked for colour blindness and contrast on each theme's surface.
// Dark uses its own steps of the same hues, not an automatic flip
const PALETTE: Record<Theme, string[]> = {
  marble: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  forge: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};
const OTHER: Record<Theme, string> = { marble: "#8a817a", forge: "#8f857c" };

// A colour follows the agent, never its rank, so the known agents keep fixed slots
const KNOWN = ["supervisor", "researcher", "writer", "summariser", "rank", "report"];

export const MAX_SERIES = PALETTE.marble.length;

// Fixed order for every agent seen: known agents first, the rest by name. A 9th and later agent is "other"
export function seriesOrder(agents: Iterable<string>): string[] {
  const all = [...new Set(agents)];
  const known = KNOWN.filter((a) => all.includes(a));
  const rest = all.filter((a) => !KNOWN.includes(a)).sort();
  return [...known, ...rest];
}

export function colorFor(order: string[], agent: string, theme: Theme): string {
  const i = order.indexOf(agent);
  return i >= 0 && i < MAX_SERIES ? PALETTE[theme][i] : OTHER[theme];
}

// The theme in use, so charts can repaint when the toggle in the nav is pressed
export function useThemeName(): Theme {
  const read = () => (document.documentElement.dataset.theme === "forge" ? "forge" : "marble");
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
