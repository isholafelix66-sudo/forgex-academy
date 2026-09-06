import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "forgex-theme";

/** Apply the theme class + keep the browser chrome color in sync. */
function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("dark", theme === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f7f9f5" : "#0b0f0e");
}

/** Read the stored preference; falls back to the saved value or dark. */
function initialTheme(): "dark" | "light" {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // storage unavailable — stay on the brand default
  }
  return "dark";
}

/**
 * Dark ↔ light theme switcher. Light mode is a "clarity" variant of the same
 * electric-black + lime brand: dark ink on near-white surfaces with the lime
 * accent re-tuned for contrast. The choice persists across reloads.
 */
export function ThemeToggle({
  className,
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const [theme, setTheme] = useState<"dark" | "light">(() => initialTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      // ignore storage failures — the toggle still works for this session
    }
  }, [theme]);

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark mode" : "Light mode"}
      className={cn(
        "theme-toggle-spin inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground",
        showLabel ? "px-3 py-2.5 text-sm font-medium" : "size-8 justify-center",
        className,
      )}
    >
      {isLight ? <Moon className="size-4" /> : <Sun className="size-4" />}
      {showLabel && <span>{isLight ? "Dark mode" : "Light mode"}</span>}
    </button>
  );
}
