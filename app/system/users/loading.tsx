export default function UsersLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Stats ribbon */}
      <div className="shrink-0 flex items-center gap-3 px-5 h-8 border-b border-zk-border/40 bg-zk-surface/10 animate-pulse">
        <div className="h-2 w-24 rounded bg-zk-green/10" />
        <div className="h-2 w-16 rounded bg-zk-green/6" />
        <div className="h-2 w-14 rounded bg-zk-green/10 ml-1" />
        <div className="ml-auto h-2 w-28 rounded bg-zk-muted/10" />
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* Left panel */}
        <div className="w-[17.5rem] shrink-0 flex flex-col border-r border-zk-border/50 bg-zk-surface/15">

          {/* Header + controls */}
          <div className="shrink-0 px-3 pt-3 pb-2.5 border-b border-zk-border/30 space-y-2.5 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-3 w-16 rounded bg-zk-green/12" />
              <div className="flex gap-1.5">
                <div className="h-5 w-5 rounded bg-zk-muted/10" />
                <div className="h-5 w-12 rounded bg-zk-green/8" />
              </div>
            </div>
            {/* Search */}
            <div className="h-7 rounded-sm bg-zk-muted/8 border border-zk-border/30" />
            {/* Pills */}
            <div className="flex gap-1">
              <div className="flex-1 h-6 rounded-sm bg-zk-green/8 border border-zk-green/20" />
              <div className="flex-1 h-6 rounded-sm bg-zk-muted/6 border border-zk-border/20" />
              <div className="flex-1 h-6 rounded-sm bg-zk-muted/6 border border-zk-border/20" />
            </div>
          </div>

          {/* User rows */}
          <div className="flex-1 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-zk-border/15 animate-pulse">
                <div className="w-8 h-8 rounded-sm bg-zk-green/6 border border-zk-border/15 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 rounded bg-zk-green/8" style={{ width: `${55 + (i * 17) % 35}%` }} />
                  <div className="h-2 rounded bg-zk-muted/8" style={{ width: `${65 + (i * 13) % 25}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — empty state shell */}
        <div className="flex-1 flex items-center justify-center bg-zk-bg animate-pulse">
          <div className="w-16 h-16 rounded-sm border border-zk-border/15 bg-zk-green/[0.02]" />
        </div>
      </div>
    </div>
  );
}
