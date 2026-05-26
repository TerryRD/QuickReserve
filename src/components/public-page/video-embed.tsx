export type ParsedVideo = { provider: 'youtube' | 'vimeo'; id: string }

export function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return { provider: 'youtube', id: yt[1]! }
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return { provider: 'vimeo', id: vm[1]! }
  return null
}

export function VideoEmbed({ url }: { url: string | null | undefined }) {
  if (!url) return null
  const parsed = parseVideoUrl(url)
  if (!parsed) return null
  const src =
    parsed.provider === 'youtube'
      ? `https://www.youtube.com/embed/${parsed.id}`
      : `https://player.vimeo.com/video/${parsed.id}`
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border bg-black">
      <iframe
        src={src}
        title="教練介紹影片"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full"
      />
    </div>
  )
}
