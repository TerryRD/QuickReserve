import { describe, it, expect } from 'vitest'
import { parseVideoUrl } from '@/components/public-page/video-embed'

describe('parseVideoUrl', () => {
  it('parses youtube.com/watch?v=', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('parses youtu.be short link', () => {
    expect(parseVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('parses youtube.com/embed/', () => {
    expect(parseVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
  })

  it('parses vimeo.com', () => {
    expect(parseVideoUrl('https://vimeo.com/123456789')).toEqual({
      provider: 'vimeo',
      id: '123456789',
    })
  })

  it('returns null for unknown provider', () => {
    expect(parseVideoUrl('https://dailymotion.com/x')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseVideoUrl('')).toBeNull()
  })

  it('returns null for malformed URL', () => {
    expect(parseVideoUrl('not a url')).toBeNull()
  })
})
