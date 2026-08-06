import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const themes = {
  crimsonNight: {
    dot: "#d6e800",
    dotBorder: "rgba(214, 232, 0, 0.65)",
    label: "Ivory Yellow",
    vars: {
      "--sr-bg": "#ffffff",
      "--sr-surface": "#ffffff",
      "--sr-surface-2": "#fafafa",
      "--sr-border": "rgba(20,20,20,0.12)",
      "--sr-text": "#111111",
      "--sr-text-sub": "rgba(17,17,17,0.72)",
      "--sr-text-muted": "rgba(17,17,17,0.5)",
      "--sr-page-text": "#111111",
      "--sr-page-text-sub": "rgba(17,17,17,0.72)",
      "--sr-page-text-muted": "rgba(17,17,17,0.5)",
      "--sr-accent": "#d6e800",
      "--sr-accent-hover": "#c5d700",
      "--sr-accent-muted": "rgba(214,232,0,0.34)",
      "--sr-nav-bg": "#ffffff",
      "--sr-nav-text": "#111111",
      "--sr-nav-text-sub": "rgba(17,17,17,0.72)",
      "--sr-nav-text-muted": "rgba(17,17,17,0.5)",
      "--sr-nav-border": "rgba(20,20,20,0.12)",
      "--sr-nav-input-bg": "#ffffff",
      "--sr-nav-input-border": "rgba(20,20,20,0.16)",
      "--sr-sidebar-bg": "#ffffff",
      "--sr-sidebar-text": "rgba(17,17,17,0.6)",
      "--sr-sidebar-border": "rgba(20,20,20,0.12)",
      "--sr-sidebar-active-bg": "rgba(214,232,0,0.2)",
      "--sr-sidebar-active-c": "#111111",
      "--sr-input-bg": "#ffffff",
      "--sr-input-border": "rgba(20,20,20,0.2)",
      "--sr-input-text": "#111111",
      "--sr-placeholder": "rgba(17,17,17,0.5)",
      "--sr-hover": "rgba(214,232,0,0.14)",
      "--sr-stat-bg": "#ffffff",
      "--sr-modal-bg": "#ffffff",
      "--sr-card-bg": "#ffffff",
      "--sr-shadow": "rgba(0,0,0,0.14)",
      "--sr-badge-bg": "rgba(214,232,0,0.2)",
      "--sr-badge-text": "#111111",
      "--sr-icon": "rgba(17,17,17,0.72)",
      "--sr-chart-grid": "rgba(20,20,20,0.14)",
      "--sr-chart-label": "rgba(17,17,17,0.72)",
      "--sr-success-bg": "rgba(214,232,0,0.2)",
      "--sr-success-text": "#111111",
      "--sr-warning-bg": "rgba(214,232,0,0.2)",
      "--sr-warning-text": "#111111",
      "--sr-danger-bg": "rgba(214,232,0,0.2)",
      "--sr-danger-text": "#111111",
      "--sr-bg-grad-a": "rgba(214,232,0,0.12)",
      "--sr-bg-grad-b": "rgba(214,232,0,0.08)"
    }
  }
};

const applyTheme = (key) => {
  const t = themes[key] || themes.crimsonNight;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", "crimson-night");
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem("sr-theme") || "crimsonNight"
  );

  const setTheme = (nextTheme = "crimsonNight") => {
    const resolved = themes[nextTheme] ? nextTheme : "crimsonNight";
    setThemeState(resolved);
  };

  useEffect(() => {
    localStorage.setItem("sr-theme", theme);
    applyTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeProvider;
