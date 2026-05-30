'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWalletStore } from '@/store/walletStore'
import { useAssetStore } from '@/store/assetStore'
import { formatDate, getPnLColor, formatCurrency } from '@/utils/format'
import { calculateLiquidationPrice } from '@/lib/calculations'
import { Plus, Pencil, Trash2, Layers, AlertTriangle, ChevronDown, ChevronUp, Eye, TrendingUp } from 'lucide-react'
import type { Asset, AssetType, AssetStatus, TransactionType, Currency } from '@/types'
import { PLATFORM_OPTIONS } from '@/types'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

// ─── Status helpers ─────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'partial_take_profit', label: 'Partial TP' },
  { value: 'closed_profit', label: 'Closed Profit' },
  { value: 'closed_loss', label: 'Closed Loss' },
  { value: 'liquidated', label: 'Liquidated' },
]

const STATUS_COLORS: Record<string, string> = {
  planned: 'text-gray-400 bg-gray-500/20',
  active: 'text-blue-400 bg-blue-500/20',
  partial_take_profit: 'text-yellow-400 bg-yellow-500/20',
  closed_profit: 'text-emerald-400 bg-emerald-500/20',
  closed_loss: 'text-red-400 bg-red-500/20',
  liquidated: 'text-red-500 bg-red-500/30',
}

const ASSET_TYPES: AssetType[] = ['Crypto', 'Forex', 'Stock', 'Commodity', 'Reksadana']
const LEVERAGE_PRESETS = [1, 5, 10, 25, 50, 100]
const LOT_PRESETS = [0.01, 0.1, 0.5, 1.0]

// ─── Schema ─────────────────────────────────────────────────────────────────
const assetSchema = z.object({
  symbol: z.string().default(''),
  productName: z.string().default(''),
  name: z.string().default(''),
  assetType: z.enum(['Crypto', 'Forex', 'Stock', 'Commodity', 'Reksadana']),
  transactionType: z.enum(['Spot', 'Margin']),
  platform: z.string().default(''),
  entryPrice: z.coerce.number().min(0),
  takeProfit: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
  stopLoss: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
  volume: z.coerce.number().min(0).default(0),
  leverage: z.coerce.number().min(0.01).default(1),
  capitalUsed: z.coerce.number().min(0).default(0),
  fee: z.coerce.number().min(0).default(0),
  entryDate: z.string(),
  notes: z.string().default(''),
  chartUrl: z.string().default(''),
  status: z.enum(['planned', 'active', 'partial_take_profit', 'closed_profit', 'closed_loss', 'liquidated']),
  exitPrice: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
  realizedPnl: z.preprocess((val) => (val === '' || val === null || val === undefined ? undefined : val), z.coerce.number().optional()),
})
type AssetForm = z.infer<typeof assetSchema>

// ─── Component ──────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const { wallet, setWallet } = useWalletStore()
  const { assets, isLoading, setAssets, setLoading, addAsset, updateAsset: storeUpdateAsset, removeAsset } = useAssetStore()
  const currency = (wallet?.currency as Currency) ?? 'USD'

  const [open, setOpen] = useState(false)
  const [editAsset, setEditAsset] = useState<Asset | null>(null)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [saving, setSaving] = useState(false)
  const [useLeverage, setUseLeverage] = useState(false)
  const [customLeverage, setCustomLeverage] = useState('')
  const [customPlatform, setCustomPlatform] = useState('')

  const form = useForm<AssetForm>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      symbol: '', productName: '', name: '',
      assetType: 'Crypto', transactionType: 'Spot', platform: '',
      entryPrice: 0, volume: 0, leverage: 1, capitalUsed: 0, fee: 0,
      notes: '', chartUrl: '', status: 'planned',
      entryDate: new Date().toISOString().split('T')[0],
    },
  })

  const watchedAssetType = form.watch('assetType')
  const watchedTxType = form.watch('transactionType')
  const watchedLeverage = form.watch('leverage')
  const watchedEntry = form.watch('entryPrice')

  const isReksadana = watchedAssetType === 'Reksadana'
  const isMargin = watchedTxType === 'Margin'
  const showLeverage = isMargin || useLeverage
  const showLotButtons = ['Forex', 'Commodity'].includes(watchedAssetType)

  // Liquidation preview
  const liqPreview = useMemo(() => {
    if (!showLeverage || watchedLeverage <= 1 || !watchedEntry) return null
    const liqLong = calculateLiquidationPrice(watchedEntry, watchedLeverage, true)
    const liqShort = calculateLiquidationPrice(watchedEntry, watchedLeverage, false)
    return { long: liqLong, short: liqShort }
  }, [showLeverage, watchedLeverage, watchedEntry])

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (filterType !== 'all') params.set('type', filterType)
      params.set('withEvents', 'true')
      const res = await fetch(`/api/assets?${params}`)
      const data = await res.json()
      setAssets(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, filterType, setAssets, setLoading])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  function openAdd() {
    setEditAsset(null)
    setUseLeverage(false)
    form.reset({
      symbol: '', productName: '', name: '',
      assetType: 'Crypto', transactionType: 'Spot', platform: '',
      entryPrice: 0, volume: 0, leverage: 1, capitalUsed: 0, fee: 0,
      notes: '', chartUrl: '', status: 'planned',
      entryDate: new Date().toISOString().split('T')[0],
      exitPrice: undefined,
      realizedPnl: undefined,
    })
    setOpen(true)
  }

  function openEdit(asset: Asset) {
    setEditAsset(asset)
    setUseLeverage(asset.leverage > 1)
    form.reset({
      symbol: asset.symbol,
      productName: asset.productName,
      name: asset.name,
      assetType: asset.assetType as AssetType,
      transactionType: asset.transactionType as TransactionType,
      platform: asset.platform,
      entryPrice: asset.entryPrice,
      takeProfit: asset.takeProfit ?? undefined,
      stopLoss: asset.stopLoss ?? undefined,
      volume: asset.volume,
      leverage: asset.leverage,
      capitalUsed: asset.capitalUsed,
      fee: asset.fee ?? 0,
      entryDate: asset.entryDate.split('T')[0],
      notes: asset.notes,
      chartUrl: asset.chartUrl || '',
      status: asset.status as AssetStatus,
      exitPrice: asset.trades?.[0]?.exitPrice ?? undefined,
      realizedPnl: asset.realizedPnl ?? undefined,
    })
    setOpen(true)
  }

  async function onSubmit(values: AssetForm) {
    setSaving(true)
    try {
      const platformValue = values.platform === 'Manual / Custom' ? customPlatform : values.platform
      if (!showLeverage) values.leverage = 1

      const res = await fetch('/api/assets', {
        method: editAsset ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editAsset
          ? { id: editAsset.id, ...values, platform: platformValue }
          : { ...values, platform: platformValue }),
      })
      const data = await res.json()
      if (data.data) {
        if (editAsset) storeUpdateAsset(data.data)
        else addAsset(data.data)
        setOpen(false)
        fetchAssets() // refresh to get latest wallet state

        // Fetch latest wallet state to update usedCapital/freeCapital dynamically
        fetch('/api/wallet')
          .then(r => r.json())
          .then(d => {
            if (d.data) setWallet(d.data)
          })
          .catch(e => console.error('Failed to sync wallet:', e))
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteAsset(id: number) {
    if (!confirm('Hapus asset ini? Posisi aktif akan mengurangi used capital.')) return
    await fetch(`/api/assets?id=${id}`, { method: 'DELETE' })
    removeAsset(id)
    fetchAssets()

    // Fetch latest wallet state to update usedCapital/freeCapital dynamically
    fetch('/api/wallet')
      .then(r => r.json())
      .then(d => {
        if (d.data) setWallet(d.data)
      })
      .catch(e => console.error('Failed to sync wallet:', e))
  }

  const fmt = (v: number) => formatCurrency(v, currency)

  const { plannedCapital, nonPlannedCapital, totalFee } = useMemo(() => {
    let planned = 0
    let nonPlanned = 0
    let feeSum = 0
    for (const a of assets) {
      const totalCapital = a.capitalUsed + (a.fee || 0)
      feeSum += (a.fee || 0)
      if (a.status === 'planned') {
        planned += totalCapital
      } else {
        nonPlanned += totalCapital
      }
    }
    return { plannedCapital: planned, nonPlannedCapital: nonPlanned, totalFee: feeSum }
  }, [assets])

  const chartData = useMemo(() => {
    let spotCapital = 0
    let marginCapital = 0

    const spotTypeMap: Record<string, number> = {}
    const marginTypeMap: Record<string, number> = {}

    // Only count active positions to reflect current active capital allocation
    const activeAssets = assets.filter(a => ['active', 'partial_take_profit'].includes(a.status))

    for (const a of activeAssets) {
      const cap = a.capitalUsed + (a.fee || 0)
      const isSpot = a.transactionType === 'Spot'

      if (isSpot) {
        spotCapital += cap
        spotTypeMap[a.assetType] = (spotTypeMap[a.assetType] || 0) + cap
      } else {
        marginCapital += cap
        marginTypeMap[a.assetType] = (marginTypeMap[a.assetType] || 0) + cap
      }
    }

    const transactionTypeData = [
      { name: 'Spot / Investasi', value: spotCapital, color: '#10B981' },
      { name: 'Margin / Futures', value: marginCapital, color: '#3B82F6' },
    ]

    const ASSET_COLORS: Record<string, string> = {
      Crypto: '#8B5CF6',
      Forex: '#F59E0B',
      Stock: '#EC4899',
      Commodity: '#EF4444',
      Reksadana: '#10B981',
    }

    const spotTypeData = Object.entries(spotTypeMap).map(([type, value]) => ({
      name: type,
      value,
      color: ASSET_COLORS[type] || '#6B7280',
    }))

    const marginTypeData = Object.entries(marginTypeMap).map(([type, value]) => ({
      name: type,
      value,
      color: ASSET_COLORS[type] || '#6B7280',
    }))

    return {
      transactionTypeData,
      spotTypeData,
      marginTypeData,
      hasActiveSpot: spotCapital > 0,
      hasActiveMargin: marginCapital > 0,
      hasActive: (spotCapital + marginCapital) > 0,
      totalActive: spotCapital + marginCapital,
      totalSpotActive: spotCapital,
      totalMarginActive: marginCapital,
    }
  }, [assets])

  return (
    <div className="space-y-4">
      {/* Baris 1: Summary Cards (Full Width) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] flex flex-col justify-center shadow-md">
          <span className="text-[10px] md:text-xs text-gray-400">Modal Direncanakan (Planned)</span>
          <span className="text-lg md:text-xl font-bold text-gray-200 mt-1 tabular-nums">
            {fmt(plannedCapital)}
          </span>
          <span className="text-[9px] md:text-[10px] text-gray-500 mt-1">
            Aset dengan status Planned
          </span>
        </div>
        <div className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] flex flex-col justify-center shadow-md">
          <span className="text-[10px] md:text-xs text-gray-400">Modal Digunakan (Non-Planned)</span>
          <span className="text-lg md:text-xl font-bold text-blue-400 mt-1 tabular-nums">
            {fmt(nonPlannedCapital)}
          </span>
          <span className="text-[9px] md:text-[10px] text-gray-500 mt-1">
            Aset aktif dan terealisasi
          </span>
        </div>
        <div className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] flex flex-col justify-center shadow-md">
          <span className="text-[10px] md:text-xs text-gray-400">Total Modal Aset (Planned + Non Planned)</span>
          <span className="text-lg md:text-xl font-bold text-emerald-400 mt-1 tabular-nums">
            {fmt(plannedCapital + nonPlannedCapital)}
          </span>
          <span className="text-[9px] md:text-[10px] text-gray-500 mt-1">
            Seluruh alokasi modal aset
          </span>
        </div>
        <div className="p-4 rounded-lg bg-[#111827] border border-[#1F2937] flex flex-col justify-center shadow-md">
          <span className="text-[10px] md:text-xs text-gray-400">Total Fee Aset</span>
          <span className="text-lg md:text-xl font-bold text-amber-500 mt-1 tabular-nums">
            {fmt(totalFee)}
          </span>
          <span className="text-[9px] md:text-[10px] text-gray-500 mt-1">
            Akumulasi biaya admin/fee aset
          </span>
        </div>
      </div>

      {/* Baris 2: 3 Chart Visualisasi Alokasi Modal Aktif */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chart 1: Spot vs Margin */}
        <Card className="flex flex-col border-[#1F2937] bg-[#111827]/40">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-300">Alokasi Spot vs Margin (Modal Aktif)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 min-h-[160px] pb-4">
            {!chartData.hasActive ? (
              <span className="text-xs text-gray-500 my-auto">Belum ada alokasi modal berjalan</span>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <div className="h-[100px] w-[100px] relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.transactionTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        dataKey="value"
                      >
                        {chartData.transactionTypeData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6, fontSize: 10 }}
                        formatter={(v: number) => [fmt(v)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 text-[10px] text-gray-300 flex-1 pl-2">
                  {chartData.transactionTypeData.map((item, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-medium">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="truncate max-w-[90px]">{item.name}</span>
                      </div>
                      <span className="text-gray-400 font-mono pl-3.5">
                        {fmt(item.value)} ({((item.value / (chartData.totalActive || 1)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Tipe Aset Spot */}
        <Card className="flex flex-col border-[#1F2937] bg-[#111827]/40">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-300">Tipe Aset (Spot / Investasi)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 min-h-[160px] pb-4">
            {!chartData.hasActiveSpot ? (
              <span className="text-xs text-gray-500 my-auto">Belum ada alokasi Spot aktif</span>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <div className="h-[100px] w-[100px] relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.spotTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        dataKey="value"
                      >
                        {chartData.spotTypeData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6, fontSize: 10 }}
                        formatter={(v: number) => [fmt(v)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 text-[10px] text-gray-300 flex-1 pl-2 max-h-[120px] overflow-y-auto font-sans">
                  {chartData.spotTypeData.map((item, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-medium">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="text-gray-400 font-mono pl-3.5">
                        {fmt(item.value)} ({((item.value / (chartData.totalSpotActive || 1)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Tipe Aset Margin */}
        <Card className="flex flex-col border-[#1F2937] bg-[#111827]/40">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-semibold text-gray-300">Tipe Aset (Margin / Futures)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center flex-1 min-h-[160px] pb-4">
            {!chartData.hasActiveMargin ? (
              <span className="text-xs text-gray-500 my-auto">Belum ada alokasi Margin aktif</span>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <div className="h-[100px] w-[100px] relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.marginTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={40}
                        dataKey="value"
                      >
                        {chartData.marginTypeData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6, fontSize: 10 }}
                        formatter={(v: number) => [fmt(v)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1.5 text-[10px] text-gray-300 flex-1 pl-2 max-h-[120px] overflow-y-auto font-sans">
                  {chartData.marginTypeData.map((item, idx) => (
                    <div key={idx} className="flex flex-col">
                      <div className="flex items-center gap-1.5 font-medium">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span>{item.name}</span>
                      </div>
                      <span className="text-gray-400 font-mono pl-3.5">
                        {fmt(item.value)} ({((item.value / (chartData.totalMarginActive || 1)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-full sm:w-44" placeholder="Cari symbol / nama..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 flex-1 sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 flex-1 sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              {ASSET_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAdd}><Plus className="h-3.5 w-3.5 mr-1.5" />Tambah Asset</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editAsset ? 'Edit Asset' : 'Tambah Asset Baru'}</DialogTitle>
              </DialogHeader>

              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* ── Tipe Transaksi ── */}
                <div className="space-y-1.5">
                  <Label>Jenis Transaksi</Label>
                  <div className="flex gap-2">
                    {(['Spot', 'Margin'] as const).map(tt => (
                      <button
                        key={tt} type="button"
                        onClick={() => form.setValue('transactionType', tt)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                          watchedTxType === tt
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-[#374151] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {tt === 'Spot' ? '🔵 Spot / Investasi' : '⚡ Margin / Futures'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Asset Type ── */}
                <div className="space-y-1.5">
                  <Label>Tipe Aset</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {ASSET_TYPES.map(at => (
                      <button
                        key={at} type="button"
                        onClick={() => form.setValue('assetType', at)}
                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                          watchedAssetType === at
                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                            : 'border-[#374151] text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        {at}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Identitas ── */}
                <div className="grid grid-cols-2 gap-3">
                  {isReksadana ? (
                    <div className="col-span-2 space-y-1.5">
                      <Label>Nama Produk Reksadana *</Label>
                      <Input {...form.register('productName')} placeholder="mis: Bibit Reksa Dana Saham..." />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label>Symbol *</Label>
                        <Input {...form.register('symbol')} placeholder="BTC, EURUSD, BBRI..." />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Nama</Label>
                        <Input {...form.register('name')} placeholder="Bitcoin, Euro/USD..." />
                      </div>
                    </>
                  )}
                </div>

                {/* ── Platform ── */}
                <div className="space-y-1.5">
                  <Label>Platform / Exchange</Label>
                  <Select
                    value={form.watch('platform')}
                    onValueChange={v => form.setValue('platform', v)}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih platform..." /></SelectTrigger>
                    <SelectContent>
                      {PLATFORM_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.watch('platform') === 'Manual / Custom' && (
                    <Input
                      value={customPlatform}
                      onChange={e => setCustomPlatform(e.target.value)}
                      placeholder="Nama platform custom..."
                      className="mt-1"
                    />
                  )}
                </div>

                {/* ── Harga, Modal & Fee ── */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Harga Entry *</Label>
                    <Input type="number" step="any" {...form.register('entryPrice')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Modal / Capital Used</Label>
                    <Input type="number" step="any" {...form.register('capitalUsed')} placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Fee / Biaya Admin</Label>
                    <Input type="number" step="any" {...form.register('fee')} placeholder="0" />
                  </div>
                </div>

                {/* Volume / Lot */}
                <div className="space-y-1.5">
                  <Label>Volume {showLotButtons ? '(Lot)' : ''}</Label>
                  {showLotButtons ? (
                    <div className="flex items-center gap-1.5">
                      {LOT_PRESETS.map(lot => (
                        <button
                          key={lot} type="button"
                          onClick={() => form.setValue('volume', lot)}
                          className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                            form.watch('volume') === lot
                              ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                              : 'border-[#374151] text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          {lot}
                        </button>
                      ))}
                      <Input
                        type="number" step="0.01"
                        className="flex-1 h-7 text-xs"
                        {...form.register('volume')}
                        placeholder="Custom lot"
                      />
                    </div>
                  ) : (
                    <Input type="number" step="any" {...form.register('volume')} placeholder="0" />
                  )}
                </div>

                {/* ── TP & SL ── */}
                {!isReksadana && (
                  <div className={`grid grid-cols-2 gap-3 ${isMargin ? 'p-2 rounded-md border border-orange-500/20 bg-orange-500/5' : ''}`}>
                    {isMargin && (
                      <p className="col-span-2 text-[10px] text-orange-400">⚡ Risk Management — penting untuk Margin/Futures</p>
                    )}
                    <div className="space-y-1.5">
                      <Label className={isMargin ? 'text-emerald-400' : ''}>Take Profit {isMargin ? '*' : '(opsional)'}</Label>
                      <Input type="number" step="any" {...form.register('takeProfit')} placeholder="0" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={isMargin ? 'text-red-400' : ''}>Stop Loss {isMargin ? '*' : '(opsional)'}</Label>
                      <Input type="number" step="any" {...form.register('stopLoss')} placeholder="0" />
                    </div>
                  </div>
                )}

                {/* ── Leverage ── */}
                {!isReksadana && (
                  <>
                    {!isMargin && (
                      <button
                        type="button"
                        onClick={() => { setUseLeverage(!useLeverage); if (useLeverage) form.setValue('leverage', 1) }}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200"
                      >
                        {useLeverage ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {useLeverage ? 'Sembunyikan Leverage' : 'Gunakan Leverage'}
                      </button>
                    )}
                    {showLeverage && (
                      <div className={`space-y-2 ${isMargin ? 'p-2 rounded-md border border-blue-500/20 bg-blue-500/5' : ''}`}>
                        <div className="flex items-center justify-between">
                          <Label>Leverage</Label>
                          <span className="text-xs font-semibold text-blue-400">{watchedLeverage}x aktif</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {LEVERAGE_PRESETS.map(l => (
                            <button
                              key={l} type="button"
                              onClick={() => form.setValue('leverage', l)}
                              className={`px-2.5 py-1 rounded text-xs font-mono border transition-colors ${
                                watchedLeverage === l
                                  ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                  : 'border-[#374151] text-gray-400 hover:border-gray-500'
                              }`}
                            >
                              {l === 1 ? '1x' : `${l}x`}
                            </button>
                          ))}
                          <div className="flex gap-1">
                            <Input
                              type="number" step="0.01" min="0.01"
                              className="h-7 w-20 text-xs"
                              placeholder="Custom"
                              value={customLeverage}
                              onChange={e => setCustomLeverage(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const v = parseFloat(customLeverage)
                                  if (v > 0) { form.setValue('leverage', v); setCustomLeverage('') }
                                }
                              }}
                            />
                            <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs"
                              onClick={() => {
                                const v = parseFloat(customLeverage)
                                if (v > 0) { form.setValue('leverage', v); setCustomLeverage('') }
                              }}>Set</Button>
                          </div>
                        </div>
                        {/* Liquidation preview */}
                        {liqPreview && (
                          <div className="flex items-center gap-2 p-2 bg-red-500/5 border border-red-500/20 rounded text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            <span className="text-gray-400">Harga Likuidasi:</span>
                            <span className="text-red-400 font-mono">Long: {liqPreview.long.toFixed(2)}</span>
                            <span className="text-red-400 font-mono">Short: {liqPreview.short.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── Meta ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={form.watch('status')} onValueChange={v => form.setValue('status', v as AssetStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tanggal Entry</Label>
                    <Input type="date" {...form.register('entryDate')} />
                  </div>
                </div>

                {/* ── Conditional fields if status is closed ── */}
                {['closed_profit', 'closed_loss', 'liquidated'].includes(form.watch('status')) && (
                  <div className="grid grid-cols-2 gap-3 p-2.5 rounded-md border border-gray-700 bg-gray-800/40">
                    <div className="space-y-1.5">
                      <Label>Harga Exit (Opsional)</Label>
                      <Input type="number" step="any" {...form.register('exitPrice')} placeholder="Harga keluar..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Realized PnL (Opsional)</Label>
                      <Input type="number" step="any" {...form.register('realizedPnl')} placeholder="Keuntungan/Kerugian..." />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Catatan</Label>
                  <Input {...form.register('notes')} placeholder="Analisis, alasan masuk..." />
                </div>

                <div className="space-y-1.5">
                  <Label>Link Chart (Opsional)</Label>
                  <Input {...form.register('chartUrl')} placeholder="https://tradingview.com/chart/..." />
                </div>

                <div className="flex justify-end gap-2 pt-1 border-t border-[#1F2937]">
                  <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>Batal</Button>
                  <Button type="submit" size="sm" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : assets.length === 0 ? (
            <EmptyState icon={Layers} title="Belum ada asset" description="Tambahkan posisi atau investasi kamu." action={<Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Tambah Asset</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aset</TableHead>
                    <TableHead className="hidden sm:table-cell">Tipe</TableHead>
                    <TableHead className="hidden lg:table-cell">Platform</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Modal</TableHead>
                    <TableHead className="hidden sm:table-cell">Lev</TableHead>
                    <TableHead>PnL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Tgl</TableHead>
                    <TableHead className="w-14">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map(asset => {
                    const pnl = asset.realizedPnl + asset.unrealizedPnl
                    const displayName = asset.assetType === 'Reksadana'
                      ? (asset.productName || asset.name)
                      : asset.symbol
                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-mono font-semibold text-blue-400 text-xs">{displayName}</p>
                              {asset.chartUrl && (
                                <a
                                  href={asset.chartUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-500 hover:text-amber-400 transition-colors"
                                  title="Buka Chart"
                                >
                                  <TrendingUp className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                            {asset.name && asset.assetType !== 'Reksadana' && (
                              <p className="text-[10px] text-gray-500 truncate max-w-[80px]">{asset.name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-gray-400">{asset.assetType}</span>
                            <span className="text-[10px] text-gray-600">{asset.transactionType}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-gray-500 max-w-[80px] truncate">{asset.platform || '—'}</TableCell>
                        <TableCell className="tabular-nums text-xs">{asset.entryPrice > 0 ? asset.entryPrice.toLocaleString() : '—'}</TableCell>
                        <TableCell className="tabular-nums text-xs">
                          {asset.capitalUsed > 0 ? (
                            <div>
                              <span>{fmt(asset.capitalUsed + (asset.fee || 0))}</span>
                              {asset.fee > 0 && (
                                <p className="text-[9px] text-gray-500 font-normal mt-0.5">
                                  (Fee: {fmt(asset.fee)})
                                </p>
                              )}
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-gray-400">{asset.leverage > 1 ? `${asset.leverage}x` : '—'}</TableCell>
                        <TableCell className={`tabular-nums text-xs font-medium ${pnl !== 0 ? getPnLColor(pnl) : 'text-gray-500'}`}>
                          {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${fmt(pnl)}` : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[asset.status] ?? 'text-gray-400'}`}>
                            {STATUS_OPTIONS.find(s => s.value === asset.status)?.label ?? asset.status}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-gray-500">{formatDate(asset.entryDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => { setDetailAsset(asset); setDetailOpen(true) }} className="p-1 hover:text-blue-400 transition-colors" title="Lihat Detail">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => openEdit(asset)} className="p-1 hover:text-blue-400 transition-colors" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteAsset(asset.id)} className="p-1 hover:text-red-400 transition-colors" title="Hapus">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Dialog Detail Aset */}
      {detailAsset && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#111827] text-gray-100 border-[#1F2937]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center justify-between">
                <span>Detail Aset: {detailAsset.assetType === 'Reksadana' ? detailAsset.productName : detailAsset.symbol}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${STATUS_COLORS[detailAsset.status] ?? 'text-gray-400'}`}>
                  {STATUS_OPTIONS.find(s => s.value === detailAsset.status)?.label ?? detailAsset.status}
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-xs mt-2">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                <div>
                  <p className="text-gray-400 font-medium">Nama Aset</p>
                  <p className="text-gray-200 mt-0.5">{detailAsset.name || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Platform / Exchange</p>
                  <p className="text-gray-200 mt-0.5">{detailAsset.platform || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Tipe Transaksi</p>
                  <p className="text-gray-200 mt-0.5">{detailAsset.transactionType}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Tanggal Entry</p>
                  <p className="text-gray-200 mt-0.5">{formatDate(detailAsset.entryDate)}</p>
                </div>
              </div>

              {/* Financial Info Grid */}
              <div className="grid grid-cols-3 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                <div>
                  <p className="text-gray-400 font-medium">Harga Entry</p>
                  <p className="text-gray-200 font-mono mt-0.5">{detailAsset.entryPrice > 0 ? detailAsset.entryPrice.toLocaleString() : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Volume / Quantity</p>
                  <p className="text-gray-200 font-mono mt-0.5">{detailAsset.volume}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Leverage</p>
                  <p className="text-gray-200 font-mono mt-0.5">{detailAsset.leverage > 1 ? `${detailAsset.leverage}x` : '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Modal Terpakai</p>
                  <p className="text-gray-200 font-mono mt-0.5">{fmt(detailAsset.capitalUsed)}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Fee Transaksi</p>
                  <p className="text-gray-200 font-mono mt-0.5">{fmt(detailAsset.fee)}</p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Modal Sekarang</p>
                  <p className="text-[#10B981] font-mono mt-0.5">{fmt(detailAsset.currentCapital)}</p>
                </div>
              </div>

              {/* PnL Section */}
              <div className="grid grid-cols-2 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                <div>
                  <p className="text-gray-400 font-medium">Realized PnL</p>
                  <p className={`font-mono font-medium mt-0.5 ${detailAsset.realizedPnl !== 0 ? getPnLColor(detailAsset.realizedPnl) : 'text-gray-500'}`}>
                    {detailAsset.realizedPnl !== 0 ? `${detailAsset.realizedPnl >= 0 ? '+' : ''}${fmt(detailAsset.realizedPnl)}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 font-medium">Unrealized PnL</p>
                  <p className={`font-mono font-medium mt-0.5 ${detailAsset.unrealizedPnl !== 0 ? getPnLColor(detailAsset.unrealizedPnl) : 'text-gray-500'}`}>
                    {detailAsset.unrealizedPnl !== 0 ? `${detailAsset.unrealizedPnl >= 0 ? '+' : ''}${fmt(detailAsset.unrealizedPnl)}` : '—'}
                  </p>
                </div>
              </div>

              {/* TP & SL */}
              {detailAsset.assetType !== 'Reksadana' && (
                <div className="grid grid-cols-2 gap-3 bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                  <div>
                    <p className="text-emerald-400 font-medium">Take Profit</p>
                    <p className="text-emerald-300 font-mono mt-0.5">{detailAsset.takeProfit ? detailAsset.takeProfit.toLocaleString() : '—'}</p>
                  </div>
                  <div>
                    <p className="text-red-400 font-medium">Stop Loss</p>
                    <p className="text-red-300 font-mono mt-0.5">{detailAsset.stopLoss ? detailAsset.stopLoss.toLocaleString() : '—'}</p>
                  </div>
                </div>
              )}

              {/* Chart Link */}
              {detailAsset.chartUrl && (
                <div className="bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937]">
                  <p className="text-gray-400 font-medium">Link Chart</p>
                  <a
                    href={detailAsset.chartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 mt-1 font-medium transition-colors"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    Buka Link Chart Analisis
                  </a>
                </div>
              )}

              {/* Notes */}
              <div>
                <p className="text-gray-400 font-medium">Catatan</p>
                <div className="bg-[#1F2937]/30 p-3 rounded-lg border border-[#1F2937] text-gray-300 mt-1 whitespace-pre-wrap">
                  {detailAsset.notes || 'Tidak ada catatan.'}
                </div>
              </div>

              {/* History Events */}
              {detailAsset.events && detailAsset.events.length > 0 && (
                <div>
                  <p className="text-gray-400 font-medium mb-1.5">Riwayat Transaksi Aset</p>
                  <div className="border border-[#1F2937] rounded-lg overflow-hidden bg-[#1F2937]/10">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-[#1F2937]/50 text-gray-400 uppercase text-[9px] tracking-wider border-b border-[#1F2937]">
                        <tr>
                          <th className="p-2">Aksi</th>
                          <th className="p-2">Harga</th>
                          <th className="p-2">Volume</th>
                          <th className="p-2">Modal Sdhnya</th>
                          <th className="p-2">Modal Stlhnya</th>
                          <th className="p-2">PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1F2937] text-gray-300 font-mono">
                        {detailAsset.events.map((ev: any) => (
                          <tr key={ev.id}>
                            <td className="p-2 font-sans font-medium capitalize">
                              <span className={`px-1 rounded text-[9px] ${
                                ev.eventType === 'entry' ? 'bg-blue-500/20 text-blue-400' :
                                ev.eventType === 'add' ? 'bg-emerald-500/20 text-emerald-400' :
                                ev.eventType === 'reduce' ? 'bg-yellow-500/20 text-yellow-400' :
                                ev.eventType === 'close' ? 'bg-gray-500/20 text-gray-400' :
                                ev.eventType === 'liquidation' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20'
                              }`}>
                                {ev.eventType}
                              </span>
                            </td>
                            <td className="p-2">{ev.price ? ev.price.toLocaleString() : '—'}</td>
                            <td className="p-2">{ev.volume}</td>
                            <td className="p-2">{fmt(ev.capitalBefore)}</td>
                            <td className="p-2">{fmt(ev.capitalAfter)}</td>
                            <td className={`p-2 ${ev.pnlRealized !== 0 ? getPnLColor(ev.pnlRealized) : 'text-gray-400'}`}>
                              {ev.pnlRealized !== 0 ? `${ev.pnlRealized >= 0 ? '+' : ''}${fmt(ev.pnlRealized)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
