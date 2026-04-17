export default function OverviewLoading() {
  return (
    <div className="h-full overflow-y-auto flex flex-col gap-4 p-6 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-36 rounded bg-zk-muted/20" />
        <div className="h-5 w-20 rounded-full bg-zk-muted/12" />
      </div>
      <div className="border border-dashed border-zk-border/40 rounded-lg p-10 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-8 rounded bg-zk-green/8" />
        <div className="h-2.5 w-32 rounded bg-zk-muted/15" />
      </div>
    </div>
  );
}
