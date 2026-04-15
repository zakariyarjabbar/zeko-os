// app/system/users/layout.tsx
// Server-side guard: moderator, admin, or Administrator can access /system/users.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEffectiveFlags } from "@/lib/effective-flags";
import { canViewUsers } from "@/lib/permissions";
import { asUserId } from "@/lib/types/ids";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const flags = await getEffectiveFlags(asUserId(session.id));
  if (!canViewUsers(flags)) redirect("/system/overview");

  return <>{children}</>;
}
