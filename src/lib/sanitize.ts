import sanitizeHtml from 'sanitize-html'

export function sanitizeBioHtml(input: string): string {
  if (!input) return ''
  return sanitizeHtml(input, {
    allowedTags: [
      'p', 'br',
      'h1', 'h2', 'h3',
      'strong', 'em', 'u', 's',
      'ul', 'ol', 'li',
      'a',
      'blockquote', 'code',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
  })
}
