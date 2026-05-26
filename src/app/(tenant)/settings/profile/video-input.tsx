'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { parseVideoUrl, VideoEmbed } from '@/components/public-page/video-embed'

type Props = {
  value: string
  onChange: (v: string) => void
}

export default function VideoInput({ value, onChange }: Props) {
  const parsed = useMemo(() => parseVideoUrl(value), [value])
  return (
    <div className="space-y-3">
      <Label htmlFor="introVideo">介紹影片（YouTube 或 Vimeo URL）</Label>
      <Input
        id="introVideo"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
      />
      {value && !parsed && <p className="text-xs text-destructive">無法辨識的連結（僅支援 YouTube / Vimeo）</p>}
      {parsed && (
        <div className="overflow-hidden rounded-xl border">
          <VideoEmbed url={value} />
        </div>
      )}
    </div>
  )
}
