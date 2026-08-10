import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const themes = {
  monochrome: {
    dot: "#ffffff",
    dotBorder: "#ffffff",
    label: "Midnight Monochrome",
    vars: {
      "--sr-bg": "#000000",
      "--sr-surface": "rgba(255,255,255,0.04)",
      "--sr-surface-2": "rgba(255,255,255,0.07)",
      "--sr-border": "rgba(255,255,255,0.22)",
      "--sr-text": "#ffffff",
      "--sr-text-sub": "rgba(255,255,255,0.72)",
      "--sr-text-muted": "rgba(255,255,255,0.54)",
      "--sr-page-text": "#ffffff",
      "--sr-page-text-sub": "rgba(255,255,255,0.72)",
      "--sr-page-text-muted": "rgba(255,255,255,0.54)",
      "--sr-accent": "#ffffff",
      "--sr-accent-hover": "#000000",
      "--sr-accent-muted": "rgba(255,255,255,0.12)",
      "--sr-nav-bg": "#000000",
      "--sr-nav-text": "#ffffff",
      "--sr-nav-text-sub": "rgba(255,255,255,0.72)",
      "--sr-nav-text-muted": "rgba(255,255,255,0.54)",
      "--sr-nav-border": "rgba(255,255,255,0.18)",
      "--sr-nav-input-bg": "rgba(255,255,255,0.05)",
      "--sr-nav-input-border": "rgba(255,255,255,0.34)",
      "--sr-sidebar-bg": "#000000",
      "--sr-sidebar-text": "rgba(255,255,255,0.72)",
      "--sr-sidebar-border": "rgba(255,255,255,0.18)",
      "--sr-sidebar-active-bg": "#ffffff",
      "--sr-sidebar-active-c": "#000000",
      "--sr-sidebar-hover-bg": "rgba(255,255,255,0.12)",
      "--sr-sidebar-hover-c": "#ffffff",
      "--sr-sidebar-hover-border": "#ffffff",
      "--sr-bottom-item-color": "rgba(255,255,255,0.72)",
      "--sr-input-bg": "rgba(255,255,255,0.05)",
      "--sr-input-border": "rgba(255,255,255,0.34)",
      "--sr-input-text": "#ffffff",
      "--sr-placeholder": "rgba(255,255,255,0.48)",
      "--sr-hover": "rgba(255,255,255,0.08)",
      "--sr-stat-bg": "rgba(255,255,255,0.05)",
      "--sr-modal-bg": "#000000",
      "--sr-card-bg": "rgba(255,255,255,0.05)",
      "--sr-shadow": "rgba(0,0,0,0.48)",
      "--sr-badge-bg": "#ffffff",
      "--sr-badge-text": "#000000",
      "--sr-icon": "#ffffff",
      "--sr-chart-grid": "rgba(255,255,255,0.18)",
      "--sr-chart-label": "rgba(255,255,255,0.66)",
      "--sr-success-bg": "rgba(255,255,255,0.12)",
      "--sr-success-text": "#ffffff",
      "--sr-warning-bg": "rgba(255,255,255,0.12)",
      "--sr-warning-text": "#ffffff",
      "--sr-danger-bg": "rgba(255,255,255,0.12)",
      "--sr-danger-text": "#ffffff",
      "--sr-bg-grad-a": "rgba(255,255,255,0.04)",
      "--sr-bg-grad-b": "rgba(255,255,255,0.02)",
      "--sr-brand-grad": "#ffffff",
      "--red-border": "rgba(255,255,255,0.55)"
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
