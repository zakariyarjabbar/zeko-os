// app/system/layout.tsx
// Shared shell for all /system/* routes.
// ┌──────────────────────────────────────┐
// │ HEADER  (Zeko OS | alerts/settings/profile) │
// ├──────────────────────────────────────┤
// │ SIDEBAR  │  page content             │
// │  Overview│                           │
// │  Chat    │                           │
// └──────────────────────────────────────┘

import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SystemSidebar } from "@/components/system/SystemSidebar";
import { SystemHeader } from "@/components/system/SystemHeader";
import { SessionProvider } from "@/components/system/SessionContext";

export default async function SystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── Auth guard ──────────────────────────────────────────────
  // Server-side: if no session cookie, kick back to /login.
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <SessionProvider session={session}>
      <div className="fixed inset-0 flex flex-col bg-zk-bg overflow-hidden">
        {/* ── Top Header ─────────────────────────────────────── */}
        <SystemHeader session={session} />

        {/* ── Body: sidebar + main ───────────────────────────── */}
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
