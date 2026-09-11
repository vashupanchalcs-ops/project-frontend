import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const themes = {
  monochrome: {
    dot: "#f6f6f6",
    dotBorder: "#f6f6f6",
    label: "Aarogya Editorial",
    vars: {
      "--sr-bg": "#ffffff",
      "--sr-surface": "#ffffff",
      "--sr-surface-2": "#f4f4f4",
      "--sr-border": "#e3e3e3",
      "--sr-text": "#111111",
      "--sr-text-sub": "#666666",
      "--sr-text-muted": "#8b8b8b",
      "--sr-page-text": "#111111",
      "--sr-page-text-sub": "#666666",
      "--sr-page-text-muted": "#8b8b8b",
      "--sr-accent": "#111111",
      "--sr-accent-hover": "#252827",
      "--sr-accent-muted": "#eeeeee",
      "--sr-nav-bg": "#151515",
      "--sr-nav-text": "#f6f6f6",
      "--sr-nav-text-sub": "#d1d1d1",
      "--sr-nav-text-muted": "#9f9f9f",
      "--sr-nav-border": "#2a2d2c",
      "--sr-nav-input-bg": "#1a1d1c",
      "--sr-nav-input-border": "#343837",
      "--sr-sidebar-bg": "#151515",
      "--sr-sidebar-text": "#d1d1d1",
      "--sr-sidebar-border": "#2a2d2c",
      "--sr-sidebar-active-bg": "#f6f6f6",
      "--sr-sidebar-active-c": "#111111",
      "--sr-sidebar-hover-bg": "#252827",
      "--sr-sidebar-hover-c": "#f6f6f6",
      "--sr-sidebar-hover-border": "#3a3e3d",
      "--sr-bottom-item-color": "#d1d1d1",
      "--sr-input-bg": "#ffffff",
      "--sr-input-border": "#a7a7a7",
      "--sr-input-text": "#111111",
      "--sr-placeholder": "#737373",
      "--sr-hover": "#f4f4f4",
      "--sr-stat-bg": "#ffffff",
      "--sr-modal-bg": "#ffffff",
      "--sr-card-bg": "#ffffff",
      "--sr-shadow": "rgba(16,18,17,0.08)",
      "--sr-badge-bg": "#111111",
      "--sr-badge-text": "#ffffff",
      "--sr-icon": "#111111",
      "--sr-chart-grid": "#e7e7e7",
      "--sr-chart-label": "#666666",
      "--sr-success-bg": "#f4f4f4",
      "--sr-success-text": "#111111",
      "--sr-warning-bg": "#f4f4f4",
      "--sr-warning-text": "#111111",
      "--sr-danger-bg": "#fff1f1",
      "--sr-danger-text": "#b20710",
      "--sr-bg-grad-a": "#ffffff",
      "--sr-bg-grad-b": "#f4f4f4",
      "--sr-brand-grad": "#111111",
      "--red-border": "#e50914"
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
