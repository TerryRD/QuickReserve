import type { Metadata } from 'next'
import { Instrument_Serif, Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const displaySerif = Instrument_Serif({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const bodySans = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

const mono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'QuickReserve — 預約管理 SaaS',
  description: '專業教練的預約系統。設定時段、開放連結、收單一條龍。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body
        className={`${displaySerif.variable} ${bodySans.variable} ${mono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
