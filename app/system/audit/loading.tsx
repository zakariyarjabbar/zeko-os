export default function AuditLoading() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center gap-3 px-5 h-10 border-b border-zk-border/40 bg-zk-surface/10 animate-pulse">
        <div className="h-3 w-24 rounded bg-zk-green/12" />
        <div className="h-3 w-16 rounded bg-zk-muted/10" />
        <div className="ml-auto h-6 w-20 rounded-sm bg-zk-green/8 border border-zk-green/20" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[24rem] shrink-0 border-r border-zk-border/50 bg-zk-surface/15 overflow-hidden">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-zk-border/15 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-2.5 rounded bg-zk-green/12" style={{ width: `${80 + (i * 17) % 90}px` }} />
                <div className="ml-auto h-2 w-14 rounded bg-zk-muted/10" />
              </div>
              <div className="mt-2 h-2 rounded bg-zk-muted/8" style={{ width: `${55 + (i * 13) % 35}%` }} />
            </div>
          ))}
        </div>
        <div className="flex-1 p-6 animate-pulse">
          <div className="h-3 w-36 rounded bg-zk-green/10" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 rounded-sm border border-zk-border/20 bg-zk-muted/5" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

