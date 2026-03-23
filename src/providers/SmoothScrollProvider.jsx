import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

const ScrollEngineContext = createContext({
  engine: "lenis",
  setEngine: () => {},
});

export const useSmoothScroll = () => useContext(ScrollEngineContext);

export default function SmoothScrollProvider({ children }) {
  const [engine, setEngineState] = useState(() => localStorage.getItem("sr-scroll-engine") || "lenis");
  const rafRef = useRef(0);

  useEffect(() => {
    const cleanup = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.scrollBehavior = "auto";
    };

    cleanup();

    // Runtime-safe smooth scrolling fallback that never imports external packages.
    // Keeps UI responsive even when optional animation libraries are not installed.
    document.documentElement.style.scrollBehavior = "smooth";
    document.body.style.scrollBehavior = "smooth";

    const sync = () => {
      rafRef.current = requestAnimationFrame(sync);
    };
    rafRef.current = requestAnimationFrame(sync);

    localStorage.setItem("sr-scroll-engine", engine);
    return cleanup;
  }, [engine]);

  const setEngine = (next) => {
    if (!["lenis", "locomotive"].includes(next)) return;
    setEngineState(next);
  };

  const value = useMemo(() => ({ engine, setEngine }), [engine]);

  return (
    <ScrollEngineContext.Provider value={value}>
      {children}
    </ScrollEngineContext.Provider>
  );
}
