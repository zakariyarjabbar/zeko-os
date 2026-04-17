// app/system/overview/page.tsx
// Placeholder — Phase 2 scaffold.

"use client";

import { Badge } from "@/components/ui/Badge";

export default function OverviewPage() {
  return (
    <div className="h-full overflow-y-auto flex flex-col gap-4 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="font-sans text-base font-semibold text-zk-white">
          System Overview
        </h1>
        <Badge variant="muted">placeholder</Badge>
      </div>

      {/* Placeholder body */}
      <div className="border border-dashed border-zk-border rounded-lg p-10 flex flex-col items-center justify-center gap-3 text-center">
        <span className="font-mono text-2xl text-zk-green/30">[ ]</span>
        <p className="font-sans text-sm text-zk-muted/50">
          Overview — coming soon
        </p>
      </div>
    </div>
  );
}
