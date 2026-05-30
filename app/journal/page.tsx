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
import { Plus, Trash2, BookOpen, CheckCircle, Wallet, Eye, TrendingUp } from 'lucide-react'
import type { Trade, Emotion, Currency, Asset } from '@/types'

const EMOTIONS: Emotion[] = ['Fear', 'Greed', 'FOMO', 'Neutral', 'Confident']

const tradeSchema = z.object({
  symbol: z.string().min(1, "Symbol wajib diisi"),
  assetId: z.string().min(1, "Aset wajib dipilih"),
  assetType: z.enum(['Crypto', 'Forex', 'Stock', 'Commodity', 'Reksadana']).optional(),
  platform: z.string().optional(),
  entryPrice: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().min(0).default(0)),
  exitPrice: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
  entryAmount: z.coerce.number().positive("Modal harus > 0"),
  leverage: z.coerce.number().min(1).default(1),
  positionSize: z.coerce.number().optional(),
  pnl: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
  pnlPercent: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
  emotion: z.enum(['Fear', 'Greed', 'FOMO', 'Neutral', 'Confident']).default('Neutral'),
  notes: z.string().default(''),
  strategy: z.string().default(''),
  status: z.enum(['open', 'closed']).default('open'),
  actionType: z.enum(['entry', 'add', 'reduce', 'close', 'cut_loss', 'liquidation', 'realize_pnl']).default('entry'),
  entryDate: z.string(),
  exitDate: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.string().optional()),
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
  const [detailTrade, setDetailTrade] = useState<Trade | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [pnlType, setPnlType] = useState<'profit' | 'loss'>('profit')
  const [pnlAmountInput, setPnlAmountInput] = useState<string>('')
  const [pnlPercentInput, setPnlPercentInput] = useState<string>('')
  const [addCapitalInput, setAddCapitalInput] = useState<string>('')
  const [reduceCapitalInput, setReduceCapitalInput] = useState<string>('')

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
      actionType: 'entry',
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

  const watchedEntryAmount = form.watch('entryAmount') || 0
  const watchedLeverage = form.watch('leverage') || 1

  const currentAction = form.watch('actionType')
  const relevantAmount = useMemo(() => {
    if (currentAction === 'add') {
      return parseFloat(addCapitalInput) || 0
    }
    if (currentAction === 'reduce') {
      return parseFloat(reduceCapitalInput) || 0
    }
    return watchedEntryAmount
  }, [currentAction, addCapitalInput, reduceCapitalInput, watchedEntryAmount])

  const watchedPositionSize = relevantAmount * watchedLeverage

  const handlePnlAmountChange = (val: string) => {
    setPnlAmountInput(val)
    if (watchedPositionSize > 0 && val !== '') {
      const num = parseFloat(val)
      if (!isNaN(num)) {
        const pct = (num / watchedPositionSize) * 100
        setPnlPercentInput(pct.toFixed(2))
      }
    } else {
      setPnlPercentInput('')
    }
  }

  const handlePnlPercentChange = (val: string) => {
    setPnlPercentInput(val)
    if (watchedPositionSize > 0 && val !== '') {
      const num = parseFloat(val)
      if (!isNaN(num)) {
        const amt = watchedPositionSize * (num / 100)
        setPnlAmountInput(amt.toFixed(2))
      }
    } else {
      setPnlAmountInput('')
    }
  }

  const watchedActionType = form.watch('actionType')
  useEffect(() => {
    if (['close', 'cut_loss', 'liquidation', 'realize_pnl'].includes(watchedActionType)) {
      form.setValue('status', 'closed')
    } else {
      form.setValue('status', 'open')
    }
  }, [watchedActionType, form])

  useEffect(() => {
    if (!open) {
      setPnlAmountInput('')
      setPnlPercentInput('')
      setPnlType('profit')
      setAddCapitalInput('')
      setReduceCapitalInput('')
    }
  }, [open])

  useEffect(() => {
    setPnlAmountInput('')
    setPnlPercentInput('')
    setAddCapitalInput('')
    setReduceCapitalInput('')
  }, [watchedAssetId])

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

  const activeAssets = useMemo(() => {
    return assets.filter(a => ['active', 'partial_take_profit'].includes(a.status))
  }, [assets])

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
      let pnl = null
      let pnlPercent = null
      let finalEntryAmount = values.entryAmount

      if (values.actionType === 'add') {
        finalEntryAmount = parseFloat(addCapitalInput) || 0
      } else if (values.actionType === 'reduce') {
        finalEntryAmount = parseFloat(reduceCapitalInput) || 0
      } else if (['close', 'cut_loss', 'liquidation', 'realize_pnl'].includes(values.actionType)) {
        const amt = parseFloat(pnlAmountInput) || 0
        const pct = parseFloat(pnlPercentInput) || 0
        const multiplier = pnlType === 'loss' ? -1 : 1
        pnl = amt * multiplier
        pnlPercent = pct * multiplier
      }

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          entryAmount: finalEntryAmount,
          pnl,
          pnlPercent,
          positionSize: finalEntryAmount * values.leverage,
        }),
      })
      if (res.ok) {
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
              <Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Log Trade or Invest</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Log Trade or Invest Baru</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                {/* Hubungkan ke Aset */}
                <div className="space-y-1.5">
                  <Label>Hubungkan ke Aset *</Label>
                  {activeAssets.length === 0 ? (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded text-xs text-yellow-400">
                      ⚠️ Tidak ada aset berjalan yang aktif. Harap tambahkan atau aktifkan aset terlebih dahulu di halaman Asset.
                    </div>
                  ) : (
                    <Select
                      value={form.watch('assetId') || ''}
                      onValueChange={v => form.setValue('assetId', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih Aset Aktif..." />
                      </SelectTrigger>
                      <SelectContent>
                        {activeAssets.map(a => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.symbol || a.productName} ({a.status === 'partial_take_profit' ? 'Partial TP' : 'Active'}) — Entry: {a.entryPrice}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {form.formState.errors.assetId && (
                    <p className="text-[10px] text-red-500 mt-1">{form.formState.errors.assetId.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Symbol *</Label>
                    <Input {...form.register('symbol')} placeholder="BTC/USDT" readOnly className="bg-gray-800/50" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Aksi Trade</Label>
                    <Select value={form.watch('actionType')} onValueChange={v => form.setValue('actionType', v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entry">Entry (Buka Posisi)</SelectItem>
                        <SelectItem value="add">Tambah Modal (Scale In)</SelectItem>
                        <SelectItem value="reduce">Kurangi Modal (Scale Out)</SelectItem>
                        <SelectItem value="realize_pnl">Realisasi Profit/Loss (Aset Tetap Aktif)</SelectItem>
                        <SelectItem value="close">Tutup Posisi (Stop Aset)</SelectItem>
                        <SelectItem value="cut_loss">Cut Loss</SelectItem>
                        <SelectItem value="liquidation">Margin Call (Rugi Total / Habis)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Harga Entry *</Label>
                    <Input type="number" step="any" {...form.register('entryPrice')} readOnly className="bg-gray-800/50 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Harga Exit</Label>
                    <Input type="number" step="any" {...form.register('exitPrice')} placeholder="Opsional" className="font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jumlah Modal Aktif</Label>
                    <Input
                      type="number"
                      step="any"
                      {...form.register('entryAmount')}
                      readOnly
                      className="bg-gray-800/50 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Leverage</Label>
                    <Input type="number" min="1" {...form.register('leverage')} readOnly className="bg-gray-800/50 font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tanggal Entry</Label>
                    <Input type="date" {...form.register('entryDate')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tanggal Exit</Label>
                    <Input type="date" {...form.register('exitDate')} />
                  </div>

                  {/* Input penambahan modal */}
                  {form.watch('actionType') === 'add' && (
                    <div className="space-y-1.5 col-span-2 p-2 bg-blue-500/5 border border-blue-500/20 rounded-md">
                      <Label className="text-blue-400">Modal yang Ditambahkan *</Label>
                      <Input
                        type="number"
                        step="any"
                        value={addCapitalInput}
                        onChange={e => setAddCapitalInput(e.target.value)}
                        placeholder="Input nominal penambahan modal..."
                        className="font-mono"
                      />
                    </div>
                  )}

                  {/* Input pengurangan modal */}
                  {form.watch('actionType') === 'reduce' && (
                    <div className="space-y-1.5 col-span-2 p-2 bg-yellow-500/5 border border-yellow-500/20 rounded-md">
                      <Label className="text-yellow-400">Modal yang Dikurangkan *</Label>
                      <Input
                        type="number"
                        step="any"
                        value={reduceCapitalInput}
                        onChange={e => setReduceCapitalInput(e.target.value)}
                        placeholder="Input nominal pengurangan modal..."
                        className="font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* PnL Section (hanya untuk realize_pnl, close, cut_loss) */}
                {['realize_pnl', 'close', 'cut_loss'].includes(form.watch('actionType')) && (
                  <div className="p-3 rounded-md border border-gray-700 bg-gray-800/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-gray-300">Hasil Keuntungan / Kerugian</Label>
                      <div className="flex bg-gray-900 rounded p-0.5 border border-gray-700">
                        <button
                          type="button"
                          onClick={() => setPnlType('profit')}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            pnlType === 'profit'
                              ? 'bg-emerald-600 text-white'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          Untung (Profit)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPnlType('loss')}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            pnlType === 'loss'
                              ? 'bg-red-600 text-white'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          Rugi (Loss)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px]">Nominal (Uang)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={pnlAmountInput}
                          onChange={e => handlePnlAmountChange(e.target.value)}
                          placeholder="0"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Persentase (%)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={pnlPercentInput}
                          onChange={e => handlePnlPercentChange(e.target.value)}
                          placeholder="0"
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Margin Call / Liquidation Preview */}
                {form.watch('actionType') === 'liquidation' && (
                  <div className="p-3 rounded-md border border-red-500/30 bg-red-500/5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-red-400 font-semibold">
                      <span>⚠️ Estimasi Hasil Margin Call</span>
                      <Badge variant="loss" className="bg-red-600 text-white border-none text-[10px] px-1.5 py-0.5">Rugi 100%</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400">Kerugian Nominal:</span>
                        <p className="font-mono text-red-400 font-semibold mt-0.5">
                          -{watchedEntryAmount.toLocaleString()} {currency}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Persentase Kerugian:</span>
                        <p className="font-mono text-red-400 font-semibold mt-0.5">-100%</p>
                      </div>
                    </div>
                  </div>
                )}

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
                  <Button type="submit" size="sm" disabled={saving || activeAssets.length === 0}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
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
            <EmptyState icon={BookOpen} title="Belum ada trade" description="Log trade or invest pertama kamu." action={<Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Log Trade or Invest</Button>} />
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
                    <TableHead className="w-14">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map(trade => (
                    <TableRow key={trade.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-blue-400 text-xs">{trade.symbol}</span>
                          {trade.asset?.chartUrl && (
                            <a
                              href={trade.asset.chartUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-amber-400 transition-colors"
                              title="Buka Chart Aset"
                            >
                              <TrendingUp className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </TableCell>
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
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setDetailTrade(trade); setDetailOpen(true) }} className="p-1 hover:text-blue-400 transition-colors" title="Lihat Detail">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteTrade(trade.id)} className="p-1 hover:text-red-400 transition-colors" title="Hapus">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Dialog Detail Trade / Jurnal */}
      {detailTrade && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#111827] text-gray-100 border-[#1F2937]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center justify-between">
                <span>Detail Jurnal: {detailTrade.symbol}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  detailTrade.status === 'open' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {detailTrade.status === 'open' ? 'Open Position' : 'Closed Position'}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-2">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                <div>
                  <p className="text-gray-400 font-medium">Symbol / Aset</p>
                  <p className="text-gray-200 mt-0.5">{detailTrade.symbol}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Strategi</p>
                  <p className="text-gray-200 mt-0.5">{detailTrade.strategy || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Emosi Saat Entry</p>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${getEmotionColor(detailTrade.emotion)}`}>
                    {detailTrade.emotion}
                  </span>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Tanggal Entry</p>
                  <p className="text-gray-200 mt-0.5">{formatDate(detailTrade.entryDate)}</p>
                </div>
                {detailTrade.exitDate && (
                  <div>
                    <p className="text-gray-400 font-medium">Tanggal Exit</p>
                    <p className="text-gray-200 mt-0.5">{formatDate(detailTrade.exitDate)}</p>
                  </div>
                )}
              </div>

              {/* Financial Info Grid */}
              <div className="grid grid-cols-3 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                <div>
                  <p className="text-gray-400 font-medium">Harga Entry</p>
                  <p className="text-gray-200 font-mono mt-0.5">{detailTrade.entryPrice.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Harga Exit</p>
                  <p className="text-gray-200 font-mono mt-0.5">{detailTrade.exitPrice ? detailTrade.exitPrice.toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Leverage</p>
                  <p className="text-gray-200 font-mono mt-0.5">{detailTrade.leverage}x</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Modal Terpasang</p>
                  <p className="text-gray-200 font-mono mt-0.5">{fmt(detailTrade.entryAmount)}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Size Posisi</p>
                  <p className="text-gray-200 font-mono mt-0.5">{fmt(detailTrade.positionSize)}</p>
                </div>
              </div>

              {/* PnL Section */}
              {detailTrade.status === 'closed' && (
                <div className="grid grid-cols-2 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                  <div>
                    <p className="text-gray-400 font-medium">Keuntungan / Kerugian (PnL)</p>
                    <p className={`font-mono font-semibold mt-0.5 ${detailTrade.pnl !== null ? getPnLColor(detailTrade.pnl) : 'text-gray-400'}`}>
                      {detailTrade.pnl !== null ? `${detailTrade.pnl >= 0 ? '+' : ''}${fmt(detailTrade.pnl)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 font-medium">Persentase PnL</p>
                    <p className={`font-mono font-semibold mt-0.5 ${detailTrade.pnlPercent !== null ? getPnLColor(detailTrade.pnlPercent) : 'text-gray-400'}`}>
                      {detailTrade.pnlPercent !== null ? `${detailTrade.pnlPercent >= 0 ? '+' : ''}${detailTrade.pnlPercent.toFixed(2)}%` : '—'}
                    </p>
                  </div>
                </div>
              )}

              {/* Linked Asset */}
              {detailTrade.asset && (
                <div className="bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937] space-y-1">
                  <p className="text-gray-400 font-medium">Aset Utama Terhubung</p>
                  <div className="flex items-center justify-between text-gray-200 mt-1">
                    <span>{detailTrade.asset.symbol || detailTrade.asset.productName} ({detailTrade.asset.assetType})</span>
                    <span className="font-mono text-gray-400">Platform: {detailTrade.asset.platform || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                    <span>Entry Aset: {detailTrade.asset.entryPrice.toLocaleString()}</span>
                    <span>Modal Berjalan: {fmt(detailTrade.asset.currentCapital)}</span>
                  </div>
                  {detailTrade.asset.chartUrl && (
                    <div className="pt-1.5 border-t border-[#1F2937] mt-1.5 flex justify-end">
                      <a
                        href={detailTrade.asset.chartUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        <TrendingUp className="h-3 w-3" />
                        Buka Link Chart
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-gray-400 font-medium">Catatan / Rencana Trade</p>
                <div className="bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937] text-gray-300 mt-1 whitespace-pre-wrap">
                  {detailTrade.notes || 'Tidak ada catatan.'}
                </div>
              </div>

              {/* Journaling details */}
              {detailTrade.journal && (
                <div className="space-y-3">
                  <p className="text-gray-400 font-medium border-t border-[#1F2937] pt-3">Evaluasi Jurnal Psikologis</p>
                  {detailTrade.journal.mistakes && (
                    <div>
                      <p className="text-red-400 font-medium">Kesalahan / Human Error</p>
                      <div className="bg-red-950/20 border border-red-900/30 p-2.5 rounded text-gray-300 mt-1">
                        {detailTrade.journal.mistakes}
                      </div>
                    </div>
                  )}
                  {detailTrade.journal.analysis && (
                    <div>
                      <p className="text-blue-400 font-medium">Analisis / Pelajaran</p>
                      <div className="bg-blue-950/20 border border-blue-900/30 p-2.5 rounded text-gray-300 mt-1">
                        {detailTrade.journal.analysis}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
