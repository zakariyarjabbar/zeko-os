// app/system/users/layout.tsx
// Server-side guard: any authenticated user can view /system/users.
// Edit/delete actions are gated per-field in the API and in the page UI.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function UsersLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <>{children}</>;
}
