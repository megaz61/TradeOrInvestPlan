'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatCard } from '@/components/ui/StatCard'
import { useWalletStore } from '@/store/walletStore'
import { calculateTradeStats } from '@/lib/calculations'
import { formatCurrency, formatPercent, getPnLColor, getEmotionColor, formatDate } from '@/utils/format'
import { Plus, Trash2, BookOpen, CheckCircle, Wallet } from 'lucide-react'
import type { Trade, Emotion, Currency, Asset } from '@/types'

const EMOTIONS: Emotion[] = ['Fear', 'Greed', 'FOMO', 'Neutral', 'Confident']

const tradeSchema = z.object({
  symbol: z.string().min(1),
  assetId: z.string().optional(),
  assetType: z.enum(['Crypto', 'Forex', 'Stock', 'Commodity', 'Reksadana']).optional(),
  platform: z.string().optional(),
  entryPrice: z.coerce.number().positive(),
  exitPrice: z.coerce.number().optional(),
  entryAmount: z.coerce.number().positive(),
  leverage: z.coerce.number().min(1).default(1),
  positionSize: z.coerce.number().optional(),
  pnl: z.coerce.number().optional(),
  pnlPercent: z.coerce.number().optional(),
  emotion: z.enum(['Fear', 'Greed', 'FOMO', 'Neutral', 'Confident']).default('Neutral'),
  notes: z.string().default(''),
  strategy: z.string().default(''),
  status: z.enum(['open', 'closed']).default('open'),
  entryDate: z.string(),
  exitDate: z.string().optional(),
})

type TradeForm = z.infer<typeof tradeSchema>

export default function JournalPage() {
  const { wallet, setWallet } = useWalletStore()
  const currency = (wallet?.currency as Currency) ?? 'USD'

  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterEmotion, setFilterEmotion] = useState('all')
  const [filterSymbol, setFilterSymbol] = useState('')
  const [timeFilter, setTimeFilter] = useState('all')
  const [walletUpdated, setWalletUpdated] = useState<number | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])

  const form = useForm<TradeForm>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      symbol: '',
      assetId: '',
      assetType: 'Crypto',
      platform: '',
      entryPrice: 0,
      entryAmount: 0,
      leverage: 1,
      emotion: 'Neutral',
      notes: '',
      strategy: '',
      status: 'open',
      entryDate: new Date().toISOString().split('T')[0],
    },
  })

  const watchedAssetId = form.watch('assetId')
  useEffect(() => {
    if (watchedAssetId && watchedAssetId !== '') {
      const selectedAsset = assets.find(a => String(a.id) === watchedAssetId)
      if (selectedAsset) {
        form.setValue('symbol', selectedAsset.symbol || selectedAsset.productName)
        form.setValue('entryPrice', selectedAsset.entryPrice)
        form.setValue('entryAmount', selectedAsset.capitalUsed + (selectedAsset.fee || 0))
        form.setValue('leverage', selectedAsset.leverage)
        form.setValue('notes', selectedAsset.notes)
        form.setValue('strategy', selectedAsset.assetType)
      }
    }
  }, [watchedAssetId, assets, form])

  const fetchTrades = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus && filterStatus !== 'all') params.set('status', filterStatus)
      if (filterEmotion && filterEmotion !== 'all') params.set('emotion', filterEmotion)
      if (filterSymbol) params.set('symbol', filterSymbol)
      const res = await fetch(`/api/trades?${params}`)
      const data = await res.json()
      setTrades(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterEmotion, filterSymbol])

  useEffect(() => { fetchTrades() }, [fetchTrades])

  useEffect(() => {
    // Fetch assets for linking
    fetch('/api/assets').then(r => r.json()).then(d => setAssets(d.data ?? []))
  }, [])

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (!trade.entryDate) return true
      const date = new Date(trade.entryDate)
      const now = new Date()
      
      if (timeFilter === 'today') {
        return date.toDateString() === now.toDateString()
      }
      
      if (timeFilter === 'week') {
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(now.getDate() - 7)
        oneWeekAgo.setHours(0, 0, 0, 0)
        return date >= oneWeekAgo && date <= now
      }
      
      if (timeFilter === 'month') {
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      }
      
      if (timeFilter === 'year') {
        return date.getFullYear() === now.getFullYear()
      }
      
      return true
    })
  }, [trades, timeFilter])

  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.status === 'closed' && t.pnl !== null)
    const pnls = closed.map(t => t.pnl as number)
    const wins = pnls.filter(p => p > 0)
    const losses = pnls.filter(p => p < 0)
    const totalPnl = pnls.reduce((a, b) => a + b, 0)
    const totalWin = wins.reduce((a, b) => a + b, 0)
    const totalLoss = losses.reduce((a, b) => a + b, 0)

    const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0
    const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0
    const bestTrade = wins.length > 0 ? Math.max(...wins) : 0
    const worstTrade = losses.length > 0 ? Math.min(...losses) : 0

    return {
      totalTrades: filteredTrades.length,
      closedTrades: closed.length,
      winRate,
      totalPnl,
      totalWin,
      totalLoss,
      avgPnl,
      bestTrade,
      worstTrade,
    }
  }, [filteredTrades])

  async function onSubmit(values: TradeForm) {
    setSaving(true)
    try {
      // Auto-calculate PnL if both entry and exit are present
      let pnl = values.pnl
      let pnlPercent = values.pnlPercent
      if (values.exitPrice && values.status === 'closed') {
        const diff = values.exitPrice - values.entryPrice
        const posSize = values.entryAmount * values.leverage
        pnl = posSize * (diff / values.entryPrice)
        pnlPercent = (diff / values.entryPrice) * 100 * values.leverage
      }

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          pnl,
          pnlPercent,
          positionSize: values.entryAmount * values.leverage,
        }),
      })
      if (res.ok) {
        const responseData = await res.json()
        setOpen(false)
        form.reset()
        fetchTrades()

        // Fetch latest wallet state to update usedCapital/freeCapital dynamically
        fetch('/api/wallet')
          .then(r => r.json())
          .then(d => {
            if (d.data) setWallet(d.data)
          })
          .catch(e => console.error('Failed to sync wallet:', e))

        // Wallet indicator
        const pnlVal = pnl ?? 0
        if (values.status === 'closed' && pnlVal !== 0) {
          setWalletUpdated(pnlVal)
          setTimeout(() => setWalletUpdated(null), 4000)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteTrade(id: number) {
    if (!confirm('Hapus trade ini?')) return
    await fetch(`/api/trades?id=${id}`, { method: 'DELETE' })
    fetchTrades()

    // Fetch latest wallet state to update usedCapital/freeCapital dynamically
    fetch('/api/wallet')
      .then(r => r.json())
      .then(d => {
        if (d.data) setWallet(d.data)
      })
      .catch(e => console.error('Failed to sync wallet:', e))
  }

  const fmt = (v: number) => formatCurrency(v, currency)

  return (
    <div className="space-y-4">
      {/* Wallet update indicator */}
      {walletUpdated !== null && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border ${
          walletUpdated >= 0
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          <CheckCircle className="h-3.5 w-3.5" />
          <Wallet className="h-3.5 w-3.5" />
          Wallet otomatis diperbarui: {walletUpdated >= 0 ? '+' : ''}{formatCurrency(walletUpdated, currency)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Total Trade" value={stats.totalTrades.toString()} />
        <StatCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} valueColor={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'} />
        <StatCard title="Total Untung" value={fmt(stats.totalWin)} valueColor="text-emerald-400" />
        <StatCard title="Total Rugi" value={fmt(stats.totalLoss)} valueColor="text-red-400" />
        <StatCard title="Net PnL" value={`${stats.totalPnl >= 0 ? '+' : ''}${fmt(stats.totalPnl)}`} valueColor={getPnLColor(stats.totalPnl)} />
        <StatCard title="Avg PnL" value={fmt(stats.avgPnl)} valueColor={getPnLColor(stats.avgPnl)} />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-36" placeholder="Filter symbol..." value={filterSymbol} onChange={e => setFilterSymbol(e.target.value)} />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmotion} onValueChange={setFilterEmotion}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Emotion" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Emosi</SelectItem>
            {EMOTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue placeholder="Waktu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Waktu</SelectItem>
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="week">Minggu Ini</SelectItem>
            <SelectItem value="month">Bulan Ini</SelectItem>
            <SelectItem value="year">Tahun Ini</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Log Trade</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Log Trade Baru</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {/* Hubungkan ke Aset */}
                <div className="space-y-1.5">
                  <Label>Hubungkan ke Aset</Label>
                  <Select
                    value={form.watch('assetId') || ''}
                    onValueChange={v => form.setValue('assetId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="-- Buat Aset Baru --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">-- Buat Aset Baru --</SelectItem>
                      {assets
                        .filter(a => ['planned', 'active', 'partial_take_profit'].includes(a.status))
                        .map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.symbol || a.productName} ({a.status}) — Entry: {a.entryPrice}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tipe & Platform jika aset baru */}
                {!form.watch('assetId') && (
                  <div className="grid grid-cols-2 gap-3 p-2 rounded-md border border-gray-700 bg-gray-800/40">
                    <div className="space-y-1.5">
                      <Label>Tipe Aset Baru</Label>
                      <Select
                        value={form.watch('assetType') || 'Crypto'}
                        onValueChange={v => form.setValue('assetType', v as any)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Crypto">Crypto</SelectItem>
                          <SelectItem value="Forex">Forex</SelectItem>
                          <SelectItem value="Stock">Stock</SelectItem>
                          <SelectItem value="Commodity">Commodity</SelectItem>
                          <SelectItem value="Reksadana">Reksadana</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Platform Aset Baru</Label>
                      <Input {...form.register('platform')} placeholder="mis: Binance, Tokocrypto" />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Symbol *</Label>
                    <Input {...form.register('symbol')} placeholder="BTC/USDT" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.watch('status')} onValueChange={v => form.setValue('status', v as 'open' | 'closed')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Harga Entry *</Label>
                    <Input type="number" step="any" {...form.register('entryPrice')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Harga Exit</Label>
                    <Input type="number" step="any" {...form.register('exitPrice')} placeholder="Opsional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jumlah Modal *</Label>
                    <Input type="number" step="any" {...form.register('entryAmount')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Leverage</Label>
                    <Input type="number" min="1" {...form.register('leverage')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tanggal Entry</Label>
                    <Input type="date" {...form.register('entryDate')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tanggal Exit</Label>
                    <Input type="date" {...form.register('exitDate')} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Emotion</Label>
                  <Select value={form.watch('emotion')} onValueChange={v => form.setValue('emotion', v as Emotion)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMOTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Strategi</Label>
                  <Input {...form.register('strategy')} placeholder="mis: Breakout, DCA, Scalping" />
                </div>
                <div className="space-y-1.5">
                  <Label>Catatan</Label>
                  <Input {...form.register('notes')} placeholder="Opsional" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
                  <Button type="submit" size="sm" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Trade Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : filteredTrades.length === 0 ? (
            <EmptyState icon={BookOpen} title="Belum ada trade" description="Log trade pertama kamu." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Log Trade</Button>} />
          ) : (
            <div className="overflow-auto sticky-header">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Exit</TableHead>
                    <TableHead>Modal</TableHead>
                    <TableHead>Lev</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead>PnL%</TableHead>
                    <TableHead>Emotion</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead className="w-12">Del</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map(trade => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-mono font-semibold text-blue-400 text-xs">{trade.symbol}</TableCell>
                      <TableCell className="tabular-nums text-xs">{trade.entryPrice.toLocaleString()}</TableCell>
                      <TableCell className="tabular-nums text-xs">{trade.exitPrice?.toLocaleString() ?? '—'}</TableCell>
                      <TableCell className="tabular-nums text-xs">{fmt(trade.entryAmount)}</TableCell>
                      <TableCell className="text-xs text-gray-400">{trade.leverage}x</TableCell>
                      <TableCell className={`tabular-nums text-xs font-medium ${trade.pnl !== null ? getPnLColor(trade.pnl) : 'text-gray-400'}`}>
                        {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}${fmt(trade.pnl)}` : '—'}
                      </TableCell>
                      <TableCell className={`tabular-nums text-xs ${trade.pnlPercent !== null ? getPnLColor(trade.pnlPercent!) : 'text-gray-400'}`}>
                        {trade.pnlPercent !== null ? `${trade.pnlPercent! >= 0 ? '+' : ''}${trade.pnlPercent!.toFixed(2)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${getEmotionColor(trade.emotion)}`}>
                          {trade.emotion}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs ${trade.status === 'open' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {trade.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-gray-400">{formatDate(trade.entryDate)}</TableCell>
                      <TableCell>
                        <button onClick={() => deleteTrade(trade.id)} className="p-1 hover:text-red-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
  )
}
