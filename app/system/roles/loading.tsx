export default function RolesLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-0 px-4 border-b border-zk-border/50 bg-zk-surface/15 animate-pulse">
        <div className="h-9 flex items-center px-4 border-b-2 border-zk-green">
          <div className="h-2.5 w-10 rounded bg-zk-green/30" />
        </div>
        <div className="h-9 flex items-center px-4">
          <div className="h-2.5 w-14 rounded bg-zk-muted/15" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left — roles list */}
        <div className="w-52 shrink-0 flex flex-col border-r border-zk-border/50 bg-zk-surface/10">

          <div className="shrink-0 flex items-center justify-between px-3 py-3 border-b border-zk-border/30 animate-pulse">
            <div className="h-3 w-12 rounded bg-zk-green/15" />
            <div className="h-5 w-10 rounded bg-zk-green/8" />
          </div>

          <div className="flex-1 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3.5 border-b border-zk-border/15 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-zk-green/20 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 rounded bg-zk-green/10" style={{ width: `${50 + (i * 23) % 35}%` }} />
                  <div className="h-2 rounded bg-zk-muted/8" style={{ width: `${40 + (i * 17) % 40}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — detail panel */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zk-bg animate-pulse">
          {/* Detail header */}
          <div className="shrink-0 flex items-center gap-3 px-6 py-4 border-b border-zk-border/30 bg-zk-surface/10">
            <div className="h-3 w-20 rounded bg-zk-green/12" />
            <div className="ml-auto flex gap-2">
              <div className="h-7 w-16 rounded bg-zk-muted/8 border border-zk-border/20" />
              <div className="h-7 w-20 rounded bg-zk-green/8 border border-zk-green/20" />
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 px-6 py-5 space-y-5">
            <div className="h-3 w-24 rounded bg-zk-muted/15" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-6 rounded border border-zk-border/20 bg-zk-muted/6"
                  style={{ width: `${60 + (i * 29) % 50}px` }} />
              ))}
            </div>
            <div className="h-px bg-zk-border/20 mt-4" />
            <div className="h-3 w-16 rounded bg-zk-muted/15" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-sm bg-zk-green/6 border border-zk-border/15" />
                  <div className="h-2.5 rounded bg-zk-muted/10" style={{ width: `${80 + (i * 31) % 80}px` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
