// app/system/roles/layout.tsx
// Server-side guard: only Administrator users can access /system/roles.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { isFounder } from "@/lib/permissions";

export default async function RolesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const flags = await getEffectiveFlags(session.id);
  if (!isFounder(flags)) redirect("/system/overview");

  return <>{children}</>;
}
