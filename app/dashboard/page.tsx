'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWalletStore } from '@/store/walletStore'
import { formatCurrency, formatPercent, getPnLColor, getEmotionColor, formatDate } from '@/utils/format'
import {
  Wallet, TrendingUp, TrendingDown, BarChart3,
  Target, Shield, DollarSign,
} from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Currency, Trade, Watchlist } from '@/types'

interface DashboardData {
  totalBalance: number
  tradingBalance: number
  usedCapital: number
  freeCapital: number
  riskExposure: number
  totalPnl: number
  portfolioPnl: number
  winRate: number
  activePositions: number
  activeAssets: number
  openTrades: number
  totalTrades: number
  currency: Currency
  recentTrades: Trade[]
  watchlistSummary: Watchlist[]
  pnlHistory: { date: string; pnl: number }[]
  stats: { winTrades: number; lossTrades: number; avgPnl: number; profitFactor: number }
}

function StatCard({
  title, value, subtitle, icon: Icon, iconColor, valueColor
}: {
  title: string; value: string; subtitle?: string
  icon: React.ElementType; iconColor?: string; valueColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-3 md:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] md:text-xs text-gray-500 truncate">{title}</p>
            <p className={`text-base md:text-lg font-bold tabular-nums mt-0.5 truncate ${valueColor ?? 'text-gray-100'}`}>
              {value}
            </p>
            {subtitle && <p className="text-[10px] text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <Icon className={`h-4 w-4 md:h-5 md:w-5 shrink-0 mt-0.5 ${iconColor ?? 'text-gray-500'}`} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { setWallet } = useWalletStore()

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/dashboard')
        const json = await res.json()
        if (!cancelled && json.data) {
          setData(json.data)
          // Populate wallet store — avoids separate /api/wallet call
          setWallet({
            id: 1, userId: 1,
            name: 'Main Wallet',
            currency: json.data.currency,
            totalBalance: json.data.totalBalance,
            tradingBalance: json.data.tradingBalance,
            usedCapital: json.data.usedCapital ?? 0,
            createdAt: '', updatedAt: '',
          })
        }
      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [setWallet])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 md:h-24" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Skeleton className="lg:col-span-2 h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Skeleton className="h-48" /><Skeleton className="h-48" />
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        Tidak dapat memuat data. Refresh halaman.
      </div>
    )
  }

  const currency = data.currency ?? 'USD'
  const fmt = (v: number) => formatCurrency(v, currency)

  const riskColor = data.riskExposure > 60 ? 'text-red-400' : data.riskExposure > 35 ? 'text-yellow-400' : 'text-emerald-400'

  const allocationPie = [
    { name: 'Digunakan', value: data.usedCapital, color: '#3B82F6' },
    { name: 'Bebas', value: Math.max(0, data.freeCapital), color: '#374151' },
  ]

  return (
    <div className="space-y-3 md:space-y-4">
      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
        <StatCard
          title="Total Wallet (For Invest/Trade)"
          value={fmt(data.totalBalance)}
          icon={Wallet} iconColor="text-blue-400"
        />
        <StatCard
          title="Modal Terpakai"
          value={fmt(data.usedCapital)}
          subtitle={data.totalBalance > 0 ? `${(data.usedCapital / data.totalBalance * 100).toFixed(1)}% dari wallet` : undefined}
          icon={TrendingUp} iconColor="text-amber-400"
        />
        <StatCard
          title="Sisa Wallet"
          value={fmt(data.freeCapital)}
          subtitle={data.totalBalance > 0 ? `${(data.freeCapital / data.totalBalance * 100).toFixed(1)}% idle` : undefined}
          icon={DollarSign}
          iconColor="text-gray-400"
        />
        <StatCard
          title="Risk Exposure"
          value={`${data.riskExposure.toFixed(1)}%`}
          subtitle="dari total wallet (For Invest/Trade)"
          icon={Shield} iconColor={riskColor} valueColor={riskColor}
        />
        <StatCard
          title="Total PnL"
          value={`${data.totalPnl >= 0 ? '+' : ''}${fmt(data.totalPnl)}`}
          icon={data.totalPnl >= 0 ? TrendingUp : TrendingDown}
          iconColor={data.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}
          valueColor={getPnLColor(data.totalPnl)}
        />
        <StatCard
          title="Win Rate"
          value={`${data.winRate.toFixed(1)}%`}
          subtitle={`${data.stats.winTrades}W / ${data.stats.lossTrades}L`}
          icon={Target}
          iconColor={data.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
          valueColor={data.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* PnL Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-gray-400">PnL Harian (30 hari terakhir)</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {data.pnlHistory.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-xs text-gray-500">Belum ada trade tertutup</div>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data.pnlHistory} margin={{ left: -10, right: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} width={50} tickFormatter={v => fmt(v)} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6, fontSize: 11 }}
                    formatter={(v: number) => [fmt(v), 'PnL']}
                  />
                  <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                    {data.pnlHistory.map((entry, i) => (
                      <Cell key={i} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Allocation Pie */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-gray-400">Alokasi Modal</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={allocationPie} cx="50%" cy="50%" innerRadius={30} outerRadius={46} dataKey="value">
                  {allocationPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6, fontSize: 11 }}
                  formatter={(v: number) => [fmt(v)]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-1.5 mt-1">
              {allocationPie.map(item => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-gray-400">{item.name}</span>
                  </div>
                  <span className="text-gray-200 tabular-nums">{fmt(item.value)}</span>
                </div>
              ))}
              {data.totalBalance > 0 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#1F2937]">
                  <span className="text-gray-500">Terpakai</span>
                  <span className={riskColor}>{data.riskExposure.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tables Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Recent Trades */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-gray-400">Trade Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentTrades.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">Belum ada trade</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>PnL</TableHead>
                      <TableHead className="hidden sm:table-cell">Emotion</TableHead>
                      <TableHead className="hidden sm:table-cell">Tgl</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentTrades.slice(0, 6).map(trade => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-mono text-xs text-blue-400 font-semibold">{trade.symbol}</TableCell>
                        <TableCell className={`tabular-nums text-xs font-medium ${trade.pnl !== null ? getPnLColor(trade.pnl) : 'text-gray-500'}`}>
                          {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}${fmt(trade.pnl)}` : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] ${getEmotionColor(trade.emotion)}`}>
                            {trade.emotion}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-gray-500">{formatDate(trade.entryDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Watchlist */}
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-gray-400">Watchlist</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.watchlistSummary.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">Watchlist kosong</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="hidden sm:table-cell">Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.watchlistSummary.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs text-blue-400 font-semibold">{item.symbol}</TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {item.targetPrice ? item.targetPrice.toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-gray-400 max-w-[160px] truncate">
                          {item.currentNote || item.notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
