export default function InboxLoading() {
  return (
    <div className="flex h-full overflow-hidden">

      {/* Left — message list */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zk-border bg-zk-surface/30">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zk-border shrink-0 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 rounded bg-zk-green/20" />
            <div className="h-3 w-10 rounded bg-zk-green/15" />
          </div>
          <div className="w-4 h-4 rounded bg-zk-muted/12" />
        </div>

        {/* Message rows */}
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3.5 border-b border-zk-border/40 animate-pulse">
              <div className="flex justify-between mb-1.5">
                <div className="h-2.5 rounded bg-zk-green/10" style={{ width: `${40 + (i * 19) % 30}%` }} />
                <div className="h-2 w-10 rounded bg-zk-muted/10" />
              </div>
              <div className="h-2 rounded bg-zk-muted/8 mb-1" style={{ width: `${60 + (i * 11) % 30}%` }} />
              <div className="h-2 w-1/2 rounded bg-zk-muted/6" />
            </div>
          ))}
        </div>
      </div>

      {/* Right — detail skeleton */}
      <div className="flex-1 flex flex-col bg-zk-bg overflow-hidden">
        <div className="flex-1 flex items-center justify-center animate-pulse">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded border border-zk-border/15 bg-zk-green/[0.02]" />
            <div className="h-2.5 w-24 rounded bg-zk-muted/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
