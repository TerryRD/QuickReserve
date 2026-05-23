export default function PageSkeleton({
  rows = 6,
  withHeader = true,
}: {
  rows?: number
  withHeader?: boolean
}) {
  return (
    <div className="space-y-6">
      {withHeader && (
        <header className="space-y-2">
          <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted/60" />
        </header>
      )}
      <div className="space-y-2 rounded-lg border bg-card p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse rounded-md bg-muted/50"
            style={{ animationDelay: `${i * 60}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
