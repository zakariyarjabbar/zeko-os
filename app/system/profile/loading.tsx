export default function ProfileLoading() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-5 animate-pulse">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-sm bg-zk-green/8 border border-zk-border/20 shrink-0" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-32 rounded bg-zk-green/10" />
            <div className="h-2.5 w-40 rounded bg-zk-muted/8" />
          </div>
        </div>

        {/* Identity + Security */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="h-64 rounded-sm border border-zk-border/20 bg-zk-surface/10" />
          <div className="h-72 rounded-sm border border-zk-border/20 bg-zk-surface/10" />
        </div>

        {/* Account info */}
        <div className="h-28 rounded-sm border border-zk-border/20 bg-zk-surface/10" />
      </div>
    </div>
  );
}
