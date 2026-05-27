'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/uiStore'
import {
  LayoutDashboard, Wallet, BarChart3, TrendingUp,
  BookOpen, LineChart, Eye, Settings,
  Calculator, Layers, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import { useEffect } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/assets', label: 'Assets', icon: Layers },
  { href: '/simulator', label: 'PnL Simulator', icon: BarChart3 },
  { href: '/leverage', label: 'Leverage', icon: TrendingUp },
  { href: '/calculator', label: 'Calculator', icon: Calculator },
  { href: '/compound', label: 'Compound', icon: LineChart },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar, mobileMenuOpen, setMobileMenuOpen } = useUIStore()

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname, setMobileMenuOpen])

  const NavContent = () => (
    <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-2.5 py-2.5 rounded-md text-sm transition-colors',
              isActive
                ? 'bg-blue-600/20 text-blue-400 font-medium'
                : 'text-gray-400 hover:bg-[#1F2937] hover:text-gray-200',
              sidebarCollapsed && 'justify-center px-0'
            )}
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon className={cn('shrink-0', sidebarCollapsed ? 'h-5 w-5' : 'h-4 w-4')} />
            {!sidebarCollapsed && <span className="truncate">{label}</span>}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* ─── Desktop Sidebar ─── */}
      <aside
        className={cn(
          'hidden md:flex flex-col h-screen bg-[#111827] border-r border-[#1F2937] transition-all duration-200 shrink-0',
          sidebarCollapsed ? 'w-14' : 'w-52'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center border-b border-[#1F2937] h-12 px-3',
          sidebarCollapsed ? 'justify-center' : 'justify-between'
        )}>
          {!sidebarCollapsed && (
            <span className="text-sm font-bold text-blue-400 tracking-wide">TradePlanner</span>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#1F2937] transition-colors"
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed
              ? <ChevronRight className="h-4 w-4" />
              : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <NavContent />

        {!sidebarCollapsed && (
          <div className="px-3 py-2 border-t border-[#1F2937]">
            <p className="text-[10px] text-gray-600">v1.1.0 · Local Mode</p>
          </div>
        )}
      </aside>

      {/* ─── Mobile Sidebar Overlay ─── */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <aside className="md:hidden fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#111827] border-r border-[#1F2937] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1F2937] h-14 px-4">
              <span className="text-sm font-bold text-blue-400 tracking-wide">TradePlanner</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-[#1F2937] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-3 rounded-md text-sm transition-colors',
                      isActive
                        ? 'bg-blue-600/20 text-blue-400 font-medium'
                        : 'text-gray-400 hover:bg-[#1F2937] hover:text-gray-200'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>
        </>
      )}
    </>
  )
}
