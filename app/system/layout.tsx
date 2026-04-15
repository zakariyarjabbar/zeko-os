// app/system/layout.tsx
// Shared shell for all /system/* routes.
// ┌──────────────────────────────────────┐
// │  HEADER  (Zeko OS | alerts/profile)  │
// ├──────────────────────────────────────┤
// │  SIDEBAR  │  page content            │
// └──────────────────────────────────────┘

import { getSession }        from "@/lib/auth";
import { buildProfile }      from "@/lib/profile";
import { redirect }          from "next/navigation";
import { SystemSidebar }     from "@/components/system/SystemSidebar";
import { SystemHeader }      from "@/components/system/SystemHeader";
import { SessionProvider }   from "@/components/system/SessionContext";
import { PresenceTracker }   from "@/components/system/PresenceTracker";
import { DisplayNameGate }   from "@/components/system/DisplayNameGate";
import { ShellPrefetcher }   from "@/components/system/ShellPrefetcher";
import type { UserProfile }  from "@/lib/profile";
import { asUserId }          from "@/lib/types/ids";

// Fallback profile when DB is unreachable
function fallbackProfile(session: { id: string; email: string; name: string; role: string }): UserProfile {
  return {
    id:            asUserId(session.id),
    displayId:     0,
    displayName:   "",
    email:         session.email,
    username:      session.name.toLowerCase().replace(/\s+/g, "."),
    role:          session.role.toUpperCase(),
    accessFlags:   [],
    sessionStatus: "OFFLINE",
    lastLoginIp:   "0.0.0.0",
    lastActive:    new Date().toISOString(),
    sessionStart:  Date.now(),
  };
}

export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Auth guard ──────────────────────────────────────────────
  const session = await getSession();
  if (!session) redirect("/login");

  // ── Fetch enriched profile ──────────────────────────────────
  // Fall back gracefully if the DB is unreachable
  let profile: UserProfile;
  try {
    profile = await buildProfile(session);
  } catch (err) {
    console.error("[layout] profile fetch failed:", err);
    profile = fallbackProfile(session);
  }

  return (
    <SessionProvider session={session} profile={profile}>
      <PresenceTracker />
      {/* Pre-warm all caches the user has permission to access */}
      <ShellPrefetcher accessFlags={profile.accessFlags} />
      {/* Blocking gate — renders only when display_name is empty */}
      <DisplayNameGate initialDisplayName={profile.displayName} />
      <div className="fixed inset-0 flex flex-col bg-zk-bg overflow-hidden">
        <SystemHeader profile={profile} session={session} />
        <div className="flex flex-1 overflow-hidden">
          <SystemSidebar />
          <main className="flex-1 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
