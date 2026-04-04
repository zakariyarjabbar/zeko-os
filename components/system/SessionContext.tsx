// components/system/SessionContext.tsx
// Client-side session + profile context — initialized by the server layout,
// consumed by any client component in the /system tree.

"use client";

import { createContext, useContext } from "react";
import { type SessionPayload } from "@/lib/auth";
import { type UserProfile } from "@/lib/profile";

interface SystemContext {
  session: SessionPayload;
  profile: UserProfile;
}

const SessionContext = createContext<SystemContext | null>(null);

export function SessionProvider({
  session,
  profile,
  children,
}: {
  session: SessionPayload;
  profile: UserProfile;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ session, profile }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionPayload {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx.session;
}

export function useProfile(): UserProfile {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useProfile must be used within SessionProvider");
  return ctx.profile;
}
