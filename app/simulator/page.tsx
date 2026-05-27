'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { useWalletStore } from '@/store/walletStore'
import { useAssetStore } from '@/store/assetStore'
import { calculatePortfolioSimulation } from '@/lib/calculations'
import { formatCurrency, getPnLColor } from '@/utils/format'
import { Plus, Trash2, Download, BarChart3, RefreshCw } from 'lucide-react'
import type { Currency, Asset } from '@/types'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16']

type Mode = 'manual' | 'import'

interface SimRow {
  id: string
  assetName: string
  capitalUsed: number
  pnlPercent: number
  isLinked: boolean
  assetId?: number
}

export default function SimulatorPage() {
  const { wallet } = useWalletStore()
  const { assets, fetchAssets, isLoading: assetsLoading } = useAssetStore()
  const currency = (wallet?.currency as Currency) ?? 'USD'

  const [mode, setMode] = useState<Mode>('manual')
  const [rows, setRows] = useState<SimRow[]>([
    { id: '1', assetName: 'Aset 1', capitalUsed: 1000, pnlPercent: 0, isLinked: false },
  ])
  const [selectedAssets, setSelectedAssets] = useState<Set<number>>(new Set())
  const [walletOverride, setWalletOverride] = useState('')

  const walletTotal = parseFloat(walletOverride) || wallet?.totalBalance || 0

  useEffect(() => {
    if (mode === 'import') fetchAssets()
  }, [mode, fetchAssets])

  const fmt = (v: number) => formatCurrency(v, currency)

  // ─── Results ───────────────────────────────────────────────────────────────
  const result = useMemo(() => {
    const validRows = rows.filter(r => r.capitalUsed > 0 && r.assetName.trim())
    if (validRows.length === 0) return null
    return calculatePortfolioSimulation(
      validRows.map(r => ({ id: r.id, assetName: r.assetName, capitalUsed: r.capitalUsed, pnlPercent: r.pnlPercent })),
      walletTotal
    )
  }, [rows, walletTotal])

  // ─── Manual mode ──────────────────────────────────────────────────────────
  function addRow() {
    setRows(prev => [...prev, {
      id: Date.now().toString(),
      assetName: `Aset ${prev.length + 1}`,
      capitalUsed: 0,
      pnlPercent: 0,
      isLinked: false,
    }])
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function updateRow(id: string, field: keyof SimRow, value: string | number) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  // ─── Import mode ──────────────────────────────────────────────────────────
  function toggleAsset(asset: Asset) {
    const newSet = new Set(selectedAssets)
    if (newSet.has(asset.id)) {
      newSet.delete(asset.id)
      setRows(prev => prev.filter(r => r.assetId !== asset.id))
    } else {
      newSet.add(asset.id)
      const displayName = asset.assetType === 'Reksadana'
        ? (asset.productName || asset.name)
        : asset.symbol
      setRows(prev => [...prev.filter(r => r.assetId !== asset.id), {
        id: `asset-${asset.id}`,
        assetName: displayName,
        capitalUsed: (asset.capitalUsed + (asset.fee || 0)) || 0,
        pnlPercent: 0,
        isLinked: true,
        assetId: asset.id,
      }])
    }
    setSelectedAssets(newSet)
  }

  function importAll() {
    const activeAssets = assets.filter(a => ['active', 'partial_take_profit'].includes(a.status) && (a.capitalUsed + (a.fee || 0)) > 0)
    const newRows = activeAssets.map(a => ({
      id: `asset-${a.id}`,
      assetName: a.assetType === 'Reksadana' ? (a.productName || a.name) : a.symbol,
      capitalUsed: a.capitalUsed + (a.fee || 0),
      pnlPercent: 0,
      isLinked: true,
      assetId: a.id,
    }))
    setRows(newRows)
    setSelectedAssets(new Set(activeAssets.map(a => a.id)))
  }

  // Switch mode → reset rows
  function switchMode(m: Mode) {
    setMode(m)
    setRows([{ id: '1', assetName: 'Aset 1', capitalUsed: 1000, pnlPercent: 0, isLinked: false }])
    setSelectedAssets(new Set())
  }

  const beforeAfterData = result?.assets.map(a => ({
    name: a.assetName,
    Sebelum: a.capitalUsed,
    Sesudah: Math.max(0, a.capitalAfter),
  })) ?? []

  return (
    <div className="space-y-4">
      {/* Header + Mode toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <h2 className="text-sm font-semibold">Portfolio Simulator</h2>
          <p className="text-xs text-gray-500">Simulasikan PnL beberapa aset sekaligus</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-md overflow-hidden border border-[#374151]">
            <button
              onClick={() => switchMode('manual')}
              className={`px-3 py-1.5 text-xs transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >Manual</button>
            <button
              onClick={() => switchMode('import')}
              className={`px-3 py-1.5 text-xs transition-colors ${mode === 'import' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >Import dari Asset</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* ─── Left Panel: Input ─── */}
        <div className="xl:col-span-1 space-y-3">
          {/* Wallet override */}
          <Card>
            <CardContent className="pt-4 space-y-2">
              <Label>Total Wallet (For Invest/Trade) (untuk % dampak)</Label>
              <Input
                type="number" step="any"
                placeholder={wallet ? fmt(wallet.totalBalance) : '0'}
                value={walletOverride}
                onChange={e => setWalletOverride(e.target.value)}
                className="h-8 text-xs"
              />
              {wallet && !walletOverride && (
                <p className="text-[10px] text-gray-500">Menggunakan wallet saat ini: {fmt(wallet.totalBalance)}</p>
              )}
            </CardContent>
          </Card>

          {/* Import mode: Asset picker */}
          {mode === 'import' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs">Pilih Asset Aktif</CardTitle>
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={importAll}>
                    <Download className="h-3 w-3 mr-1" />Semua Aktif
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-64 overflow-y-auto">
                {assetsLoading ? (
                  <div className="p-3 space-y-1.5">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                ) : assets.length === 0 ? (
                  <p className="text-xs text-gray-500 p-3">Belum ada asset tersimpan.</p>
                ) : (
                  <div className="divide-y divide-[#1F2937]">
                    {assets.map(asset => {
                      const selected = selectedAssets.has(asset.id)
                      const displayName = asset.assetType === 'Reksadana' ? (asset.productName || asset.name) : asset.symbol
                      return (
                        <button
                          key={asset.id}
                          onClick={() => toggleAsset(asset)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[#1F2937] ${selected ? 'bg-blue-600/10' : ''}`}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selected ? 'border-blue-500 bg-blue-500' : 'border-gray-600'}`}>
                            {selected && <span className="text-white text-[10px]">✓</span>}
                          </div>
                          <span className="font-mono text-blue-400">{displayName}</span>
                          <span className="text-gray-500 text-[10px]">{asset.assetType}</span>
                          {asset.capitalUsed > 0 && (
                            <span className="ml-auto text-gray-400">{fmt(asset.capitalUsed)}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Input table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs">Input PnL per Aset</CardTitle>
                {mode === 'manual' && (
                  <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={addRow}>
                    <Plus className="h-3 w-3 mr-1" />Tambah
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="text-xs text-gray-500 p-3">Belum ada aset dipilih.</p>
              ) : (
                <div className="divide-y divide-[#1F2937]">
                  {rows.map(row => (
                    <div key={row.id} className="px-3 py-2 space-y-1.5">
                      {mode === 'manual' && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            className="h-7 text-xs flex-1"
                            value={row.assetName}
                            onChange={e => updateRow(row.id, 'assetName', e.target.value)}
                            placeholder="Nama aset"
                          />
                          <button onClick={() => removeRow(row.id)} className="p-1 hover:text-red-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {mode === 'import' && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-blue-400">{row.assetName}</span>
                          <button onClick={() => removeRow(row.id)} className="p-1 hover:text-red-400">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">Modal</p>
                          <Input
                            type="number" step="any" className="h-7 text-xs"
                            value={row.capitalUsed || ''}
                            onChange={e => updateRow(row.id, 'capitalUsed', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 mb-0.5">PnL %</p>
                          <Input
                            type="number" step="0.1" className="h-7 text-xs"
                            value={row.pnlPercent || ''}
                            onChange={e => updateRow(row.id, 'pnlPercent', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Right Panel: Results ─── */}
        <div className="xl:col-span-2 space-y-4">
          {!result ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-gray-500">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 text-gray-600" />
                Isi data aset di kiri untuk melihat simulasi portfolio
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-[10px] text-gray-500">Total Modal</p>
                    <p className="text-sm font-bold tabular-nums mt-0.5">{fmt(result.totalCapitalUsed)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-[10px] text-gray-500">Total PnL</p>
                    <p className={`text-sm font-bold tabular-nums mt-0.5 ${getPnLColor(result.totalPnlNominal)}`}>
                      {result.totalPnlNominal >= 0 ? '+' : ''}{fmt(result.totalPnlNominal)}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${getPnLColor(result.totalPnlPercent)}`}>
                      {result.totalPnlPercent >= 0 ? '+' : ''}{result.totalPnlPercent.toFixed(2)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-[10px] text-gray-500">Wallet Setelah</p>
                    <p className="text-sm font-bold tabular-nums mt-0.5">{fmt(result.walletAfter)}</p>
                    <p className={`text-[10px] mt-0.5 ${getPnLColor(result.walletAfter - walletTotal)}`}>
                      {result.walletAfter >= walletTotal ? '+' : ''}{fmt(result.walletAfter - walletTotal)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-3 pb-3">
                    <p className="text-[10px] text-gray-500">Best / Worst</p>
                    <p className="text-xs text-emerald-400 truncate mt-0.5">{result.bestAsset?.assetName ?? '—'}</p>
                    <p className="text-xs text-red-400 truncate">{result.worstAsset?.assetName ?? '—'}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Pie */}
                <Card>
                  <CardHeader><CardTitle className="text-xs">Alokasi Modal</CardTitle></CardHeader>
                  <CardContent className="pb-2">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={result.allocationData}
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={72}
                          dataKey="value"
                          nameKey="name"
                        >
                          {result.allocationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#111827', border: '1px solid #1F2937', fontSize: 11 }}
                          formatter={(v: number) => [fmt(v)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {result.allocationData.map((d, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] text-gray-400">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="truncate max-w-[60px]">{d.name}</span>
                          <span className="text-gray-500">{d.percent.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Before/After Bar */}
                <Card>
                  <CardHeader><CardTitle className="text-xs">Sebelum vs Sesudah</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={beforeAfterData} margin={{ left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#6B7280' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} />
                        <Tooltip
                          contentStyle={{ background: '#111827', border: '1px solid #1F2937', fontSize: 11 }}
                          formatter={(v: number) => [fmt(v)]}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="Sebelum" fill="#374151" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="Sesudah" radius={[2, 2, 0, 0]}>
                          {beforeAfterData.map((d, i) => (
                            <Cell key={i} fill={d.Sesudah >= d.Sebelum ? '#10B981' : '#EF4444'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detail Table */}
              <Card>
                <CardHeader><CardTitle className="text-xs">Detail per Aset</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aset</TableHead>
                        <TableHead>Modal</TableHead>
                        <TableHead>PnL %</TableHead>
                        <TableHead>PnL Nominal</TableHead>
                        <TableHead>Modal Akhir</TableHead>
                        <TableHead>Alokasi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.assets.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs text-blue-400 font-semibold">{row.assetName}</TableCell>
                          <TableCell className="tabular-nums text-xs">{fmt(row.capitalUsed)}</TableCell>
                          <TableCell className={`tabular-nums text-xs font-medium ${getPnLColor(row.pnlPercent)}`}>
                            {row.pnlPercent >= 0 ? '+' : ''}{row.pnlPercent.toFixed(2)}%
                          </TableCell>
                          <TableCell className={`tabular-nums text-xs font-medium ${getPnLColor(row.pnlNominal)}`}>
                            {row.pnlNominal >= 0 ? '+' : ''}{fmt(row.pnlNominal)}
                          </TableCell>
                          <TableCell className="tabular-nums text-xs">{fmt(row.capitalAfter)}</TableCell>
                          <TableCell className="text-xs text-gray-400">{row.allocationPercent.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                      {/* Total row */}
                      <TableRow className="font-semibold bg-[#111827]">
                        <TableCell className="text-xs">TOTAL</TableCell>
                        <TableCell className="tabular-nums text-xs">{fmt(result.totalCapitalUsed)}</TableCell>
                        <TableCell className={`tabular-nums text-xs ${getPnLColor(result.totalPnlPercent)}`}>
                          {result.totalPnlPercent >= 0 ? '+' : ''}{result.totalPnlPercent.toFixed(2)}%
                        </TableCell>
                        <TableCell className={`tabular-nums text-xs ${getPnLColor(result.totalPnlNominal)}`}>
                          {result.totalPnlNominal >= 0 ? '+' : ''}{fmt(result.totalPnlNominal)}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs">{fmt(result.totalCapitalAfter)}</TableCell>
                        <TableCell className="text-xs text-gray-400">100%</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
