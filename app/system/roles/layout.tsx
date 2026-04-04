// app/system/roles/layout.tsx
// Server-side guard: only ROOT_ACCESS users can access /system/roles.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isFounder } from "@/lib/permissions";

interface ProfileFlags { access_flags: string[]; }

export default async function RolesLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("access_flags")
    .eq("id", session.id)
    .single();

  if (!isFounder((data as ProfileFlags | null)?.access_flags ?? [])) {
    redirect("/system/overview");
  }

  return <>{children}</>;
}
