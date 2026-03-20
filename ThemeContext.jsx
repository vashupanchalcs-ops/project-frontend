import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export const themes = {
  dark: {
    dot: "#0a0a0a", dotBorder: "#444444", label: "Dark",
    vars: {
      "--sr-bg":"#0a0a0a","--sr-surface":"#141414","--sr-surface-2":"#1c1c1c",
      "--sr-surface-3":"#222","--sr-border":"rgba(255,255,255,0.08)",
      "--sr-text":"#ffffff","--sr-text-sub":"rgba(255,255,255,0.45)",
      "--sr-text-muted":"rgba(255,255,255,0.22)",
      "--sr-page-text":"#ffffff","--sr-page-text-sub":"rgba(255,255,255,0.45)",
      "--sr-page-text-muted":"rgba(255,255,255,0.22)",
      "--sr-accent":"#E50914","--sr-accent-hover":"#f40612",
      "--sr-accent-muted":"rgba(229,9,20,0.12)",
      "--sr-nav-bg":"rgba(10,10,10,0.97)","--sr-nav-text":"#ffffff",
      "--sr-nav-text-sub":"rgba(255,255,255,0.45)","--sr-nav-text-muted":"rgba(255,255,255,0.22)",
      "--sr-nav-border":"rgba(255,255,255,0.08)","--sr-nav-input-bg":"rgba(255,255,255,0.06)",
      "--sr-nav-input-border":"rgba(255,255,255,0.12)",
      "--sr-sidebar-bg":"#0a0a0a","--sr-sidebar-text":"rgba(255,255,255,0.32)",
      "--sr-sidebar-active-bg":"rgba(229,9,20,0.12)","--sr-sidebar-active-c":"#E50914",
      "--sr-sidebar-border":"rgba(255,255,255,0.06)",
      "--sr-input-bg":"rgba(255,255,255,0.05)","--sr-input-border":"rgba(255,255,255,0.1)",
      "--sr-input-text":"#ffffff","--sr-placeholder":"rgba(255,255,255,0.22)",
      "--sr-hover":"rgba(255,255,255,0.05)",
      "--sr-stat-bg":"#141414","--sr-modal-bg":"#141414","--sr-card-bg":"#141414",
      "--sr-shadow":"rgba(0,0,0,0.6)","--sr-badge-bg":"rgba(255,255,255,0.07)",
      "--sr-badge-text":"rgba(255,255,255,0.55)","--sr-icon":"rgba(255,255,255,0.38)",
      "--sr-chart-grid":"rgba(255,255,255,0.06)","--sr-chart-label":"rgba(255,255,255,0.38)",
      "--sr-success-bg":"rgba(0,212,170,0.12)","--sr-success-text":"#00d4aa",
      "--sr-warning-bg":"rgba(247,201,72,0.12)","--sr-warning-text":"#f7c948",
      "--sr-danger-bg":"rgba(229,9,20,0.12)","--sr-danger-text":"#ff4d5a",
    },
  },
  grey: {
    dot: "#888", dotBorder: "#aaa", label: "Grey",
    vars: {
      "--sr-bg":"#1e1e1e","--sr-surface":"#282828","--sr-surface-2":"#323232",
      "--sr-surface-3":"#3a3a3a","--sr-border":"rgba(255,255,255,0.1)",
      "--sr-text":"#f0f0f0","--sr-text-sub":"rgba(240,240,240,0.5)",
      "--sr-text-muted":"rgba(240,240,240,0.28)",
      "--sr-page-text":"#f0f0f0","--sr-page-text-sub":"rgba(240,240,240,0.5)",
      "--sr-page-text-muted":"rgba(240,240,240,0.28)",
      "--sr-accent":"#E50914","--sr-accent-hover":"#f40612",
      "--sr-accent-muted":"rgba(229,9,20,0.12)",
      "--sr-nav-bg":"rgba(22,22,22,0.97)","--sr-nav-text":"#f0f0f0",
      "--sr-nav-text-sub":"rgba(240,240,240,0.5)","--sr-nav-text-muted":"rgba(240,240,240,0.28)",
      "--sr-nav-border":"rgba(255,255,255,0.1)","--sr-nav-input-bg":"rgba(255,255,255,0.08)",
      "--sr-nav-input-border":"rgba(255,255,255,0.14)",
      "--sr-sidebar-bg":"#1a1a1a","--sr-sidebar-text":"rgba(240,240,240,0.4)",
      "--sr-sidebar-active-bg":"rgba(229,9,20,0.12)","--sr-sidebar-active-c":"#E50914",
      "--sr-sidebar-border":"rgba(255,255,255,0.08)",
      "--sr-input-bg":"rgba(255,255,255,0.07)","--sr-input-border":"rgba(255,255,255,0.12)",
      "--sr-input-text":"#f0f0f0","--sr-placeholder":"rgba(240,240,240,0.28)",
      "--sr-hover":"rgba(255,255,255,0.06)",
      "--sr-stat-bg":"#282828","--sr-modal-bg":"#282828","--sr-card-bg":"#282828",
      "--sr-shadow":"rgba(0,0,0,0.5)","--sr-badge-bg":"rgba(255,255,255,0.08)",
      "--sr-badge-text":"rgba(240,240,240,0.55)","--sr-icon":"rgba(240,240,240,0.38)",
      "--sr-chart-grid":"rgba(255,255,255,0.07)","--sr-chart-label":"rgba(240,240,240,0.4)",
      "--sr-success-bg":"rgba(0,212,170,0.12)","--sr-success-text":"#00d4aa",
      "--sr-warning-bg":"rgba(247,201,72,0.12)","--sr-warning-text":"#f7c948",
      "--sr-danger-bg":"rgba(229,9,20,0.12)","--sr-danger-text":"#ff4d5a",
    },
  },
  white: {
    dot: "#ffffff", dotBorder: "#cccccc", label: "Light",
    vars: {
      "--sr-bg":"#f5f5f7","--sr-surface":"#ffffff","--sr-surface-2":"#f0f0f2",
      "--sr-surface-3":"#e8e8ec","--sr-border":"rgba(0,0,0,0.08)",
      "--sr-text":"#0a0a0a","--sr-text-sub":"rgba(0,0,0,0.5)",
      "--sr-text-muted":"rgba(0,0,0,0.28)",
      "--sr-page-text":"#0a0a0a","--sr-page-text-sub":"rgba(0,0,0,0.5)",
      "--sr-page-text-muted":"rgba(0,0,0,0.28)",
      "--sr-accent":"#E50914","--sr-accent-hover":"#cc0710",
      "--sr-accent-muted":"rgba(229,9,20,0.08)",
      "--sr-nav-bg":"rgba(255,255,255,0.97)","--sr-nav-text":"#0a0a0a",
      "--sr-nav-text-sub":"rgba(0,0,0,0.5)","--sr-nav-text-muted":"rgba(0,0,0,0.3)",
      "--sr-nav-border":"rgba(0,0,0,0.08)","--sr-nav-input-bg":"rgba(0,0,0,0.04)",
      "--sr-nav-input-border":"rgba(0,0,0,0.12)",
      "--sr-sidebar-bg":"#ffffff","--sr-sidebar-text":"rgba(0,0,0,0.4)",
      "--sr-sidebar-active-bg":"rgba(229,9,20,0.08)","--sr-sidebar-active-c":"#E50914",
      "--sr-sidebar-border":"rgba(0,0,0,0.07)",
      "--sr-input-bg":"rgba(0,0,0,0.04)","--sr-input-border":"rgba(0,0,0,0.1)",
      "--sr-input-text":"#0a0a0a","--sr-placeholder":"rgba(0,0,0,0.28)",
      "--sr-hover":"rgba(0,0,0,0.04)",
      "--sr-stat-bg":"#ffffff","--sr-modal-bg":"#ffffff","--sr-card-bg":"#ffffff",
      "--sr-shadow":"rgba(0,0,0,0.1)","--sr-badge-bg":"rgba(0,0,0,0.06)",
      "--sr-badge-text":"rgba(0,0,0,0.55)","--sr-icon":"rgba(0,0,0,0.35)",
      "--sr-chart-grid":"rgba(0,0,0,0.07)","--sr-chart-label":"rgba(0,0,0,0.38)",
      "--sr-success-bg":"rgba(0,180,130,0.1)","--sr-success-text":"#00875a",
      "--sr-warning-bg":"rgba(200,140,0,0.1)","--sr-warning-text":"#b36800",
      "--sr-danger-bg":"rgba(229,9,20,0.08)","--sr-danger-text":"#cc0710",
    },
  },
};

const applyTheme = (key) => {
  const t = themes[key]; if (!t) return;
  const r = document.documentElement;
  Object.entries(t.vars).forEach(([k,v]) => r.style.setProperty(k, v));
  r.setAttribute("data-theme", key);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => localStorage.getItem("sr-theme") || "white");
  const setTheme = (key) => {
    if (!themes[key]) return;
    setThemeState(key); localStorage.setItem("sr-theme", key); applyTheme(key);
  };
  useEffect(() => { applyTheme(theme); }, []);
  return <ThemeContext.Provider value={{ theme, setTheme, themes }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeProvider;