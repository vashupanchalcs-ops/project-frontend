import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

const themes = {
  crimsonNight: {
    dot: "#ff3347",
    dotBorder: "rgba(255, 51, 71, 0.7)",
    label: "Crimson Night",
    vars: {
      "--sr-bg": "#0b0608",
      "--sr-surface": "#171013",
      "--sr-surface-2": "#221217",
      "--sr-border": "rgba(255,255,255,0.13)",
      "--sr-text": "#fff7f7",
      "--sr-text-sub": "rgba(255,247,247,0.76)",
      "--sr-text-muted": "rgba(255,247,247,0.54)",
      "--sr-page-text": "#fff7f7",
      "--sr-page-text-sub": "rgba(255,247,247,0.76)",
      "--sr-page-text-muted": "rgba(255,247,247,0.54)",
      "--sr-accent": "#e50914",
      "--sr-accent-hover": "#ff3347",
      "--sr-accent-muted": "rgba(229,9,20,0.28)",
      "--sr-nav-bg": "#120a0d",
      "--sr-nav-text": "#fff7f7",
      "--sr-nav-text-sub": "rgba(255,247,247,0.72)",
      "--sr-nav-text-muted": "rgba(255,247,247,0.48)",
      "--sr-nav-border": "rgba(255,255,255,0.12)",
      "--sr-nav-input-bg": "#211217",
      "--sr-nav-input-border": "rgba(255,255,255,0.19)",
      "--sr-sidebar-bg": "#10080b",
      "--sr-sidebar-text": "rgba(255,247,247,0.62)",
      "--sr-sidebar-border": "rgba(255,255,255,0.1)",
      "--sr-sidebar-active-bg": "#e50914",
      "--sr-sidebar-active-c": "#ffffff",
      "--sr-sidebar-hover-bg": "rgba(229,9,20,0.18)",
      "--sr-sidebar-hover-c": "#ffffff",
      "--sr-sidebar-hover-border": "rgba(255,51,71,0.72)",
      "--sr-bottom-item-color": "rgba(255,247,247,0.62)",
      "--sr-input-bg": "#160b0f",
      "--sr-input-border": "rgba(255,255,255,0.2)",
      "--sr-input-text": "#fff7f7",
      "--sr-placeholder": "rgba(255,247,247,0.48)",
      "--sr-hover": "rgba(229,9,20,0.16)",
      "--sr-stat-bg": "#1a0d11",
      "--sr-modal-bg": "#170b10",
      "--sr-card-bg": "#170d11",
      "--sr-shadow": "rgba(0,0,0,0.42)",
      "--sr-badge-bg": "rgba(229,9,20,0.18)",
      "--sr-badge-text": "#fff7f7",
      "--sr-icon": "rgba(255,247,247,0.78)",
      "--sr-chart-grid": "rgba(255,255,255,0.15)",
      "--sr-chart-label": "rgba(255,247,247,0.66)",
      "--sr-success-bg": "rgba(22,163,74,0.18)",
      "--sr-success-text": "#86efac",
      "--sr-warning-bg": "rgba(245,158,11,0.18)",
      "--sr-warning-text": "#fcd34d",
      "--sr-danger-bg": "rgba(229,9,20,0.18)",
      "--sr-danger-text": "#fda4af",
      "--sr-bg-grad-a": "rgba(150,13,28,0.3)",
      "--sr-bg-grad-b": "rgba(229,9,20,0.14)",
      "--sr-brand-grad": "linear-gradient(135deg, #e50914 0%, #8f0611 100%)",
      "--red-border": "rgba(255,70,85,0.55)"
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
