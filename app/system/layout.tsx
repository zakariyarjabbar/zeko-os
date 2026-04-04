// app/system/layout.tsx
// Shared shell for all /system/* routes.
// ┌──────────────────────────────────────┐
// │  HEADER  (Zeko OS | alerts/profile)  │
// ├──────────────────────────────────────┤
// │  SIDEBAR  │  page content            │
// └──────────────────────────────────────┘

import { getSession }      from "@/lib/auth";
import { buildProfile }    from "@/lib/profile";
import { redirect }        from "next/navigation";
import { SystemSidebar }   from "@/components/system/SystemSidebar";
import { SystemHeader }    from "@/components/system/SystemHeader";
import { SessionProvider } from "@/components/system/SessionContext";
import type { UserProfile } from "@/lib/profile";

// Fallback profile when DB is unreachable
function fallbackProfile(session: { id: string; email: string; name: string; role: string }): UserProfile {
  return {
    id:             session.id,
    displayId:      "user-0",
    email:          session.email,
    username:       session.name.toLowerCase().replace(" ", "."),
    firstName:      session.name,
    lastName:       "",
    role:           session.role.toUpperCase(),
    alias:          session.name.toLowerCase().replace(" ", "."),

    department:     "Unassigned",

    accessFlags:    ["READ_LOGS"],
    sessionStatus:  "OFFLINE",
    lastLoginIp:    "0.0.0.0",
    lastActive:     new Date().toISOString(),
    sessionStart:   Date.now(),
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
