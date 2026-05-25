export default function PublicPageSkeleton() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-3xl px-4 pb-16">
        {/* Hero */}
        <header className="-mx-4 mb-2 overflow-hidden bg-foreground px-6 pb-12 pt-14 text-background sm:mx-0 sm:mt-8 sm:rounded-3xl sm:px-10">
          <div className="h-3 w-32 animate-pulse rounded bg-background/20" />
          <div className="mt-4 h-12 w-2/3 animate-pulse rounded bg-background/30" />
          <div className="mt-6 h-4 w-3/4 animate-pulse rounded bg-background/20" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-background/20" />
        </header>

        {/* Service grid (3 cards) */}
        <section className="mt-6 sm:mt-8">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border bg-card"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </section>

        {/* Date strip */}
        <section className="mt-6">
          <div className="mb-3 h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border bg-card"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </section>

        {/* Slot grid */}
        <section className="mt-6">
          <div className="mb-3 h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl border bg-card"
                style={{ animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
