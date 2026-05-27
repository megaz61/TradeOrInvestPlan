'use client'

import { usePathname } from 'next/navigation'
import { useWalletStore } from '@/store/walletStore'
import { useUIStore } from '@/store/uiStore'
import { formatCurrency } from '@/utils/format'
import { Wallet, Menu } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/wallet': 'Wallet',
  '/assets': 'Assets & Positions',
  '/simulator': 'PnL Simulator',
  '/leverage': 'Leverage Simulator',
  '/calculator': 'Calculator',
  '/compound': 'Compound Simulator',
  '/journal': 'Trade Journal',
  '/watchlist': 'Watchlist',
  '/settings': 'Settings',
}

export function Topbar() {
  const pathname = usePathname()
  const { wallet, freeCapital } = useWalletStore()
  const { toggleMobileMenu } = useUIStore()

  const title = PAGE_TITLES[pathname] ?? 'Trading Planner'

  return (
    <header className="h-12 flex items-center justify-between px-3 md:px-4 border-b border-[#1F2937] bg-[#111827] shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobileMenu}
          className="md:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-[#1F2937] transition-colors shrink-0"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Mobile brand */}
        <span className="md:hidden text-xs font-bold text-blue-400 tracking-wide shrink-0">TP</span>
        {/* Page title */}
        <h1 className="text-sm font-semibold text-gray-200 truncate">{title}</h1>
      </div>

      {wallet && (
        <div className="flex items-center gap-2 md:gap-3 text-xs text-gray-400 shrink-0">
          {/* Total Wallet */}
          <div className="flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-gray-500 hidden sm:inline">Total:</span>
            <span className="tabular-nums font-semibold text-gray-200">
              {formatCurrency(wallet.totalBalance, wallet.currency as any)}
            </span>
          </div>

          <div className="w-px h-4 bg-[#1F2937]" />

          {/* Free Capital */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Free:</span>
            <span className="tabular-nums font-semibold text-emerald-400">
              {formatCurrency(freeCapital, wallet.currency as any)}
            </span>
          </div>

          <div className="w-px h-4 bg-[#1F2937]" />

          {/* Modal Terpakai */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Terpakai:</span>
            <span className="tabular-nums font-semibold text-amber-400">
              {formatCurrency(wallet.usedCapital ?? 0, wallet.currency as any)}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
