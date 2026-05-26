export default function BioBlock({ html }: { html: string | null | undefined }) {
  if (!html || !html.trim()) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">關於</h2>
      <article
        className="prose prose-sm max-w-none prose-headings:font-display prose-a:text-primary"
        // bio_html 已在 server 端 sanitize-html 過濾，DB 內容受信任
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  )
}
