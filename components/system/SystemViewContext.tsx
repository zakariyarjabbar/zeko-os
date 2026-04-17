"use client";

// Pure client-side view switcher — no Next.js routing, no server round-trips.
// navigate() changes the view instantly via setState + history.pushState.
// Browser back/forward is handled via popstate.

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

export type SystemView = "overview" | "chat" | "inbox" | "users" | "roles";

const VIEW_PATHS: Record<SystemView, string> = {
  overview: "/system/overview",
  chat:     "/system/chat",
  inbox:    "/system/inbox",
  users:    "/system/users",
  roles:    "/system/roles",
};

function pathToView(path: string): SystemView {
  if (path.startsWith("/system/chat"))     return "chat";
  if (path.startsWith("/system/inbox"))    return "inbox";
  if (path.startsWith("/system/users"))    return "users";
  if (path.startsWith("/system/roles"))    return "roles";
  return "overview";
}

interface SystemViewCtx {
  view:     SystemView;
  navigate: (v: SystemView) => void;
}

const SystemViewContext = createContext<SystemViewCtx | null>(null);

export function SystemViewProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [view, setView] = useState<SystemView>(() => pathToView(pathname));

  // Keep in sync with browser back / forward buttons
  useEffect(() => {
    function onPop() {
      setView(pathToView(window.location.pathname));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((v: SystemView) => {
    setView(v);                                    // instant — triggers re-render NOW
    window.history.pushState(null, "", VIEW_PATHS[v]); // sync URL, no server fetch
  }, []);

  return (
    <SystemViewContext.Provider value={{ view, navigate }}>
      {children}
    </SystemViewContext.Provider>
  );
}

export function useSystemView(): SystemViewCtx {
  const ctx = useContext(SystemViewContext);
  if (!ctx) throw new Error("useSystemView must be used within SystemViewProvider");
  return ctx;
}
