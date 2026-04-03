// components/system/SessionContext.tsx
// Client-side session context — initialized by the server layout,
// consumed by any client component in the /system tree.

"use client";

import { createContext, useContext } from "react";
import { type SessionPayload } from "@/lib/auth";

const SessionContext = createContext<SessionPayload | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionPayload;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionPayload {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
