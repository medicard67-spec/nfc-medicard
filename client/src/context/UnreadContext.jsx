import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./AuthContext.jsx";
import api from "../lib/api.js";

const UnreadContext = createContext(null);

export function UnreadProvider({ children }) {
  const { role, profile } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!profile || role === "admin") return;
    api
      .get("/messages/unread-count")
      .then((res) => setCount(res.data.count))
      .catch(() => {});
  }, [profile, role]);

  useEffect(() => {
    refresh();
    if (!profile || role === "admin") return;
    const interval = setInterval(refresh, 20000);
    return () => clearInterval(interval);
  }, [profile, role, refresh]);

  return <UnreadContext.Provider value={{ count, refresh }}>{children}</UnreadContext.Provider>;
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error("useUnread must be used within UnreadProvider");
  return ctx;
}
