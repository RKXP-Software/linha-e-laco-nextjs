import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google'
import { PwaRegistrar } from '@/components/pwa-registrar'
import './globals.css'

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display' })
const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Linha & Laço',
  description: 'Gestão delicada para um ateliê em movimento.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Linha & Laço', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#b55e58' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body className={`${display.variable} ${sans.variable}`}><PwaRegistrar/>{children}</body></html>
}
