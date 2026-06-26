import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'My Profit and Loss — P&L for Small Businesses',
  description: 'AI-powered P&L and tax expense categorization for small US businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakartaSans.variable} ${jetbrainsMono.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
