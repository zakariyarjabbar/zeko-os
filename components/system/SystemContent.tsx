"use client";

// Renders the active system section based on client-side view state.
// All sections are eagerly imported so switching is always instant —
// no chunk download, no server round-trip, no Suspense.
//
// Hydration strategy: SSR always renders the matching loading skeleton
// (deterministic, no sessionStorage reads). After mount, actual page
// components take over — React batches the swap before the first paint
// for client-side navigations, so users never see a flash.

import { useState, useEffect }  from "react";
import { useSystemView }         from "@/components/system/SystemViewContext";
import { useProfile }            from "@/components/system/SessionContext";
import { canViewInbox, isFounder, canManageRoles, canManagePermissions } from "@/lib/permissions";

// Loading skeletons — safe to render on server (no dynamic data)
import UsersLoading    from "@/app/system/users/loading";
import ChatLoading     from "@/app/system/chat/loading";
import InboxLoading    from "@/app/system/inbox/loading";
import RolesLoading    from "@/app/system/roles/loading";
import AuditLoading    from "@/app/system/audit/loading";
import OverviewLoading from "@/app/system/overview/loading";
import ProfileLoading  from "@/app/system/profile/loading";

// Eagerly import every section — they all share the same client bundle
import OverviewPage from "@/app/system/overview/page";
import ChatPage     from "@/app/system/chat/page";
import InboxPage    from "@/app/system/inbox/page";
import UsersPage    from "@/app/system/users/page";
import RolesPage    from "@/app/system/roles/page";
import AuditPage    from "@/app/system/audit/page";
import ProfilePage  from "@/app/system/profile/page";

function LoadingSkeleton({ view }: { view: string }) {
  switch (view) {
    case "chat":    return <ChatLoading />;
    case "inbox":   return <InboxLoading />;
    case "users":   return <UsersLoading />;
    case "roles":   return <RolesLoading />;
    case "audit":   return <AuditLoading />;
    case "profile": return <ProfileLoading />;
    default:        return <OverviewLoading />;
  }
}

export function SystemContent() {
  const { view } = useSystemView();
  const profile  = useProfile();
  const flags    = profile.accessFlags;

  // Start with false on both server and client to avoid hydration mismatch.
  // sessionStorage is client-only, so any cache reads must happen after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // Before mount: render the skeleton that matches the active view.
  // The server renders this same skeleton, so SSR HTML matches client.
  if (!mounted) return <LoadingSkeleton view={view} />;

  // Client-side permission guard — mirrors the server-side layout guards
  const effectiveView =
    (view === "roles" && !isFounder(flags) && !canManageRoles(flags) && !canManagePermissions(flags)) ? "overview" :
    (view === "audit" && !isFounder(flags)) ? "overview" :
    (view === "inbox" && !canViewInbox(flags)) ? "overview" :
    view;

  switch (effectiveView) {
    case "chat":    return <ChatPage />;
    case "inbox":   return <InboxPage />;
    case "users":   return <UsersPage />;
    case "roles":   return <RolesPage />;
    case "audit":   return <AuditPage />;
    case "profile": return <ProfilePage />;
    default:        return <OverviewPage />;
  }
}
