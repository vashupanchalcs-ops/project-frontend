import { useMemo, useState } from "react";
import { AppContext } from "./app-context";

export function AppProvider({ children }) {
  const [searchTerm, setSearchTerm] = useState("");

  const value = useMemo(() => ({ searchTerm, setSearchTerm }), [searchTerm]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
