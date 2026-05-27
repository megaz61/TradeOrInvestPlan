import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { WalletProvider } from '@/components/providers/WalletProvider'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: {
    default: 'Trading or Investment Planner',
    template: '%s | Trading or Investment Planner',
  },
  description: 'Personal Trading & Investment Planner — risk management, PnL simulation, trade journal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0F19] text-gray-100 antialiased">
        <WalletProvider>
          <div className="flex h-screen h-dvh overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              <Topbar />
              <main className="flex-1 overflow-y-auto p-3 md:p-4">
                {children}
              </main>
            </div>
          </div>
        </WalletProvider>
      </body>
    </html>
  )
}
