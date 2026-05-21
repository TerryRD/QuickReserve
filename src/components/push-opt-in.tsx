'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

type Status = 'loading' | 'unsupported' | 'denied' | 'subscribed' | 'available'

export default function PushOptIn() {
  const [status, setStatus] = useState<Status>('loading')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    void (async () => {
      if (typeof window === 'undefined') return
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('unsupported')
        return
      }
      if (Notification.permission === 'denied') {
        setStatus('denied')
        return
      }
      try {
        const reg = await navigator.serviceWorker.ready
        const existing = await reg.pushManager.getSubscription()
        setStatus(existing ? 'subscribed' : 'available')
      } catch {
        setStatus('available')
      }
    })()
  }, [])

  async function subscribe() {
    setPending(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        toast.error('已拒絕通知權限。可在瀏覽器設定中改回。')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
      const json = sub.toJSON()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      })
      if (!res.ok) throw new Error('subscribe failed')
      setStatus('subscribed')
      toast.success('已啟用通知')
    } catch (err) {
      console.error(err)
      toast.error('啟用通知失敗')
    } finally {
      setPending(false)
    }
  }

  async function unsubscribe() {
    setPending(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: 'DELETE',
        })
        await sub.unsubscribe()
      }
      setStatus('available')
      toast.success('已關閉通知')
    } catch {
      toast.error('關閉失敗')
    } finally {
      setPending(false)
    }
  }

  if (status === 'loading') return null
  if (status === 'unsupported') {
    return (
      <div className="rounded border bg-amber-50 p-3 text-xs text-amber-800">
        您的瀏覽器不支援推播通知
      </div>
    )
  }
  if (status === 'denied') {
    return (
      <div className="rounded border bg-amber-50 p-3 text-xs text-amber-800">
        瀏覽器已封鎖通知權限。請到瀏覽器設定 → 網站權限 → 通知 重新開啟。
      </div>
    )
  }
  if (status === 'subscribed') {
    return (
      <div className="flex items-center gap-3 rounded border bg-emerald-50 p-3 text-sm">
        <span className="flex-1">🔔 推播通知已啟用</span>
        <Button size="sm" variant="outline" onClick={unsubscribe} disabled={pending}>
          停用
        </Button>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 rounded border bg-blue-50 p-3 text-sm">
      <span className="flex-1">啟用瀏覽器推播通知，預約有變動時即時通知</span>
      <Button size="sm" onClick={subscribe} disabled={pending}>
        啟用通知
      </Button>
    </div>
  )
}
