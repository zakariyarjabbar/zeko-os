// components/system/SessionContext.tsx
// Client-side session + profile context — initialized by the server layout,
// consumed by any client component in the /system tree.
//
// profile.accessFlags is held in state and updated live when the SSE stream
// emits a "flags" signal (via the "zk:flags:updated" window event dispatched
// by ShellPrefetcher).  No page refresh needed when roles change.

"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { type SessionPayload } from "@/lib/auth";
import { type UserProfile } from "@/lib/profile";

interface SystemContext {
  session: SessionPayload;
  profile: UserProfile;
}

const SessionContext = createContext<SystemContext | null>(null);

export function SessionProvider({
  session,
  profile: initialProfile,
  children,
}: {
  session: SessionPayload;
  profile: UserProfile;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState(initialProfile);

  useEffect(() => {
    function onFlagsUpdated(e: Event) {
      const data = (e as CustomEvent<{ ids: string[]; names: string[] }>).detail;
      if (data && Array.isArray(data.ids)) {
        setProfile((p) => ({
          ...p,
          accessFlags:     data.ids,
          accessFlagNames: data.names ?? [],
        }));
      }
    }
    window.addEventListener("zk:flags:updated", onFlagsUpdated);
    return () => window.removeEventListener("zk:flags:updated", onFlagsUpdated);
  }, []);

  useEffect(() => {
    function onProfileUpdated(e: Event) {
      const updates = (e as CustomEvent<Partial<UserProfile>>).detail;
      if (updates && typeof updates === "object") {
        setProfile((p) => ({ ...p, ...updates }));
      }
    }
    window.addEventListener("zk:profile:updated", onProfileUpdated);
    return () => window.removeEventListener("zk:profile:updated", onProfileUpdated);
  }, []);

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
