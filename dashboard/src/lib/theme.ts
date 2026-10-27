import { useEffect, useState } from "react";

export type Theme = "marble" | "forge";

export const LANGFUSE_URL = "http://localhost:3000";

// index.html sets the first theme before paint, this keeps it in sync after that
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) ?? "marble",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("heph-theme", theme);
    } catch {
      // Private windows may block storage, the theme still works for this visit
    }
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "marble" ? "forge" : "marble")) };
}
