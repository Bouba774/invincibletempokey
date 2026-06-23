/**
 * Skeletons calibrés sur la structure réelle des composants.
 * Utilise la classe `.shimmer` (cf. styles.css) pour un effet pro et discret.
 */

function Bar({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`shimmer rounded-md ${className}`} style={style} />;
}

export function TrackRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
      <Bar className="h-9 w-9 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bar className="h-3.5 w-3/4" />
        <div className="flex items-center gap-2">
          <Bar className="h-4 w-8" />
          <Bar className="h-3 w-14" />
          <Bar className="h-3 w-10" />
        </div>
      </div>
      <Bar className="h-7 w-7 shrink-0 rounded-md" />
    </div>
  );
}

export function TrackListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2 px-4 py-3">
      {Array.from({ length: rows }).map((_, i) => (
        <TrackRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function SuggestionSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border bg-[var(--surface-elevated)] px-3 py-2"
        >
          <Bar className="h-6 w-9 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bar className="h-3 w-2/3" />
            <Bar className="h-2.5 w-1/3" />
          </div>
          <Bar className="h-7 w-7 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Bar className="h-3 w-16" />
            <Bar className="mt-3 h-6 w-20" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <Bar className="h-3.5 w-32" />
        <div className="mt-4 flex items-end gap-1.5">
          {Array.from({ length: 18 }).map((_, i) => (
            <Bar
              key={i}
              className="w-3"
              style={{ height: `${20 + ((i * 37) % 70)}px` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

