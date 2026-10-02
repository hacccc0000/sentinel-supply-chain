import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";
const Ctx = createContext<{ theme: Theme; toggle: () => void }>({ theme: "light", toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const saved = localStorage.getItem("buildbouncer-theme");
    const next = saved === "dark" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);
  const toggle = () => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("buildbouncer-theme", next);
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  };
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-line bg-elev px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-paper-2",
        compact && "px-2",
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      {!compact && (
        <span>
          Theme: <strong className="text-ink">{theme === "dark" ? "Dark" : "Light"}</strong>
        </span>
      )}
    </button>
  );
}
