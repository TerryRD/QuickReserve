import Image from 'next/image'

type Photo = { id: string; public_url: string; caption: string | null }

export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  if (photos.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        環境 / 照片
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="group overflow-hidden rounded-xl border bg-card">
            <div className="relative aspect-square w-full overflow-hidden">
              <Image
                src={p.public_url}
                alt={p.caption ?? ''}
                fill
                sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            {p.caption && (
              <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
                {p.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  )
}
