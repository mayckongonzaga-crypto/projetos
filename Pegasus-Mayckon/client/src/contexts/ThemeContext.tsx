import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

export type ThemeBase = "emerald" | "sunset" | "midnight";
export type ThemeMode = "light" | "dim" | "dark";
export type PegasusTheme = `${ThemeBase}` | `${ThemeBase}-dim` | `${ThemeBase}-dark`;

export const THEME_BASES: ThemeBase[] = ["emerald", "sunset", "midnight"];
export const THEME_MODES: ThemeMode[] = ["light", "dim", "dark"];

export const BASE_LABELS: Record<ThemeBase, string> = {
  emerald: "Emerald",
  sunset: "Sunset",
  midnight: "Midnight",
};

export const MODE_LABELS: Record<ThemeMode, string> = {
  light: "Claro",
  dim: "Penumbra",
  dark: "Escuro",
};

export const MODE_ICONS: Record<ThemeMode, string> = {
  light: "☀️",
  dim: "🌤️",
  dark: "🌙",
};

export const BASE_DESCRIPTIONS: Record<ThemeBase, string> = {
  emerald: "Verde profissional, limpo e moderno. Ideal para uso diário.",
  sunset: "Terracota elegante, quente e sofisticado. Visual premium.",
  midnight: "Azul corporativo, confiável e clássico. Estilo executivo.",
};

export const THEME_LIST: PegasusTheme[] = [
  "emerald", "emerald-dim", "emerald-dark",
  "sunset", "sunset-dim", "sunset-dark",
  "midnight", "midnight-dim", "midnight-dark",
];

export const THEME_LABELS: Record<PegasusTheme, string> = {
  emerald: "Emerald Claro",
  "emerald-dim": "Emerald Penumbra",
  "emerald-dark": "Emerald Escuro",
  sunset: "Sunset Claro",
  "sunset-dim": "Sunset Penumbra",
  "sunset-dark": "Sunset Escuro",
  midnight: "Midnight Claro",
  "midnight-dim": "Midnight Penumbra",
  "midnight-dark": "Midnight Escuro",
};

export function getThemeBase(theme: PegasusTheme): ThemeBase {
  return theme.replace("-dark", "").replace("-dim", "") as ThemeBase;
}

export function getThemeMode(theme: PegasusTheme): ThemeMode {
  if (theme.endsWith("-dark")) return "dark";
  if (theme.endsWith("-dim")) return "dim";
  return "light";
}

export function makeTheme(base: ThemeBase, mode: ThemeMode): PegasusTheme {
  if (mode === "dark") return `${base}-dark`;
  if (mode === "dim") return `${base}-dim`;
  return base;
}

interface ThemeContextType {
  theme: PegasusTheme;
  setTheme: (theme: PegasusTheme) => void;
  isDark: boolean;
  themeBase: ThemeBase;
  themeMode: ThemeMode;
  setThemeBase: (base: ThemeBase) => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: PegasusTheme;
}

export function ThemeProvider({
  children,
  defaultTheme = "midnight",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<PegasusTheme>(() => {
    const stored = localStorage.getItem("pegasus-theme");
    if (stored && THEME_LIST.includes(stored as PegasusTheme)) {
      return stored as PegasusTheme;
    }
    return defaultTheme;
  });

  const setTheme = useCallback((newTheme: PegasusTheme) => {
    setThemeState(newTheme);
    localStorage.setItem("pegasus-theme", newTheme);
  }, []);

  const themeBase = getThemeBase(theme);
  const themeMode = getThemeMode(theme);
  const isDark = themeMode === "dark" || themeMode === "dim";

  const setThemeBase = useCallback((base: ThemeBase) => {
    setTheme(makeTheme(base, themeMode));
  }, [themeMode, setTheme]);

  const setMode = useCallback((mode: ThemeMode) => {
    setTheme(makeTheme(themeBase, mode));
  }, [themeBase, setTheme]);

  const toggleMode = useCallback(() => {
    // Cycle: light -> dim -> dark -> light
    const modes: ThemeMode[] = ["light", "dim", "dark"];
    const currentIdx = modes.indexOf(themeMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setTheme(makeTheme(themeBase, nextMode));
  }, [themeMode, themeBase, setTheme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // Both dim and dark get the .dark class for Tailwind dark: variants
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme, isDark]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark, themeBase, themeMode, setThemeBase, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
