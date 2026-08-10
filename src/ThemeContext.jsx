import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const themes = {
  monochrome: {
    dot: "#000000",
    dotBorder: "#000000",
    label: "Monochrome",
    vars: {
      "--sr-bg": "#ffffff",
      "--sr-surface": "#ffffff",
      "--sr-surface-2": "#ffffff",
      "--sr-border": "rgba(0,0,0,0.18)",
      "--sr-text": "#000000",
      "--sr-text-sub": "rgba(0,0,0,0.72)",
      "--sr-text-muted": "rgba(0,0,0,0.54)",
      "--sr-page-text": "#000000",
      "--sr-page-text-sub": "rgba(0,0,0,0.72)",
      "--sr-page-text-muted": "rgba(0,0,0,0.54)",
      "--sr-accent": "#000000",
      "--sr-accent-hover": "#ffffff",
      "--sr-accent-muted": "rgba(0,0,0,0.08)",
      "--sr-nav-bg": "#ffffff",
      "--sr-nav-text": "#000000",
      "--sr-nav-text-sub": "rgba(0,0,0,0.72)",
      "--sr-nav-text-muted": "rgba(0,0,0,0.54)",
      "--sr-nav-border": "rgba(0,0,0,0.16)",
      "--sr-nav-input-bg": "#ffffff",
      "--sr-nav-input-border": "rgba(0,0,0,0.34)",
      "--sr-sidebar-bg": "#ffffff",
      "--sr-sidebar-text": "rgba(0,0,0,0.72)",
      "--sr-sidebar-border": "rgba(0,0,0,0.16)",
      "--sr-sidebar-active-bg": "#000000",
      "--sr-sidebar-active-c": "#ffffff",
      "--sr-sidebar-hover-bg": "#000000",
      "--sr-sidebar-hover-c": "#ffffff",
      "--sr-sidebar-hover-border": "#000000",
      "--sr-bottom-item-color": "rgba(0,0,0,0.72)",
      "--sr-input-bg": "#ffffff",
      "--sr-input-border": "rgba(0,0,0,0.34)",
      "--sr-input-text": "#000000",
      "--sr-placeholder": "rgba(0,0,0,0.48)",
      "--sr-hover": "rgba(0,0,0,0.06)",
      "--sr-stat-bg": "#ffffff",
      "--sr-modal-bg": "#ffffff",
      "--sr-card-bg": "#ffffff",
      "--sr-shadow": "rgba(0,0,0,0.10)",
      "--sr-badge-bg": "#000000",
      "--sr-badge-text": "#ffffff",
      "--sr-icon": "#000000",
      "--sr-chart-grid": "rgba(0,0,0,0.15)",
      "--sr-chart-label": "rgba(0,0,0,0.66)",
      "--sr-success-bg": "#000000",
      "--sr-success-text": "#ffffff",
      "--sr-warning-bg": "#000000",
      "--sr-warning-text": "#ffffff",
      "--sr-danger-bg": "#000000",
      "--sr-danger-text": "#ffffff",
      "--sr-bg-grad-a": "rgba(0,0,0,0.04)",
      "--sr-bg-grad-b": "rgba(0,0,0,0.02)",
      "--sr-brand-grad": "#000000",
      "--red-border": "#000000"
    }
  }
};

const applyTheme = (key) => {
  const t = themes[key] || themes.monochrome;
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", "monochrome");
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem("sr-theme") || "monochrome"
  );

  const setTheme = (nextTheme = "monochrome") => {
    const resolved = themes[nextTheme] ? nextTheme : "monochrome";
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
