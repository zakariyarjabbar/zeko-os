export default function ChatLoading() {
  return (
    <div className="flex h-full overflow-hidden">

      {/* Sidebar */}
      <div className="w-52 shrink-0 flex flex-col border-r border-zk-border/60 bg-zk-surface/40">

        {/* Channels section */}
        <div className="px-3 pt-4 pb-2 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-2 w-16 rounded bg-zk-muted/20" />
            <div className="h-4 w-4 rounded bg-zk-muted/10" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-2 py-1.5 mb-0.5 rounded">
              <div className="w-3.5 h-3.5 rounded bg-zk-muted/15 shrink-0" />
              <div className="h-2.5 rounded bg-zk-muted/12" style={{ width: `${50 + (i * 23) % 40}%` }} />
            </div>
          ))}
        </div>

        <div className="h-px bg-zk-border/30 mx-3" />

        {/* DMs section */}
        <div className="px-3 pt-3 pb-2 animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-2 w-20 rounded bg-zk-muted/20" />
            <div className="h-4 w-4 rounded bg-zk-muted/10" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 px-1.5 py-2 mb-0.5 rounded">
              <div className="w-6 h-6 rounded-sm bg-zk-muted/15 shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-2.5 rounded bg-zk-muted/12" style={{ width: `${50 + (i * 29) % 35}%` }} />
                <div className="h-2 rounded bg-zk-muted/8" style={{ width: `${40 + (i * 19) % 35}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-zk-bg">

        {/* Channel header */}
        <div className="shrink-0 h-12 flex items-center px-5 gap-4 border-b border-zk-border/60 animate-pulse">
          <div className="h-3 w-28 rounded bg-zk-muted/20" />
          <div className="w-px h-4 bg-zk-border/40" />
          <div className="h-2.5 w-40 rounded bg-zk-muted/12" />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden px-5 py-4 space-y-5 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-sm bg-zk-green/8 border border-zk-border/15 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-16 rounded bg-zk-green/12" />
                  <div className="h-2 w-12 rounded bg-zk-muted/10" />
                </div>
                <div className="h-2.5 rounded bg-zk-muted/10" style={{ width: `${40 + (i * 31) % 50}%` }} />
                {i % 3 === 0 && (
                  <div className="h-2.5 rounded bg-zk-muted/8" style={{ width: `${30 + (i * 17) % 40}%` }} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="shrink-0 px-5 pb-4 pt-2 animate-pulse">
          <div className="h-10 rounded border border-zk-border/40 bg-zk-surface/40" />
        </div>
      </div>
    </div>
  );
}
