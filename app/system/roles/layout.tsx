// app/system/roles/layout.tsx
// Server-side guard: roles-manager or permission-manager (or Administrator) can access /system/roles.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEffectivePermissions } from "@/lib/effective-flags";
import { canManageRoles, canManagePermissions, isFounder } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";

export default async function RolesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { ids } = await getEffectivePermissions(asUserId(session.id));
  if (!isFounder(ids) && !canManageRoles(ids) && !canManagePermissions(ids)) {
    redirect("/system/overview");
  }

  return <>{children}</>;
}
