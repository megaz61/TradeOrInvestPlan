'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWalletStore } from '@/store/walletStore'
import { calculateCompoundGrowth } from '@/lib/calculations'
import { formatCurrency, formatPercent } from '@/utils/format'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Currency } from '@/types'

const PRESETS = [
  { label: '7 Hari', days: 7 },
  { label: '30 Hari', days: 30 },
  { label: '90 Hari', days: 90 },
  { label: '365 Hari', days: 365 },
]

export default function CompoundPage() {
  const { wallet } = useWalletStore()
  const currency = (wallet?.currency as Currency) ?? 'USD'

  const [initial, setInitial] = useState(wallet?.tradingBalance?.toString() ?? '1000')
  const [dailyPct, setDailyPct] = useState('1')
  const [days, setDays] = useState('30')

  const initialNum = parseFloat(initial) || 0
  const dailyNum = parseFloat(dailyPct) || 0
  const daysNum = parseInt(days) || 0

  const result = useMemo(() => {
    if (!initialNum || !dailyNum || !daysNum) return null
    return calculateCompoundGrowth(initialNum, dailyNum, Math.min(daysNum, 365))
  }, [initialNum, dailyNum, daysNum])

  // Untuk chart, sample setiap N hari agar tidak terlalu banyak
  const chartData = useMemo(() => {
    if (!result) return []
    const step = result.rows.length > 90 ? 7 : result.rows.length > 30 ? 3 : 1
    return result.rows.filter((_, i) => i % step === 0 || i === result.rows.length - 1)
  }, [result])

  const fmt = (v: number) => formatCurrency(v, currency)

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Inputs */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Parameter Compound</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Modal Awal</Label>
              <Input type="number" value={initial} onChange={e => setInitial(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Growth Harian (%)</Label>
              <Input type="number" step="0.1" value={dailyPct} onChange={e => setDailyPct(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Jumlah Hari</Label>
              <Input type="number" value={days} onChange={e => setDays(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {PRESETS.map(p => (
              <Button
                key={p.days}
                size="sm"
                variant={parseInt(days) === p.days ? 'default' : 'outline'}
                onClick={() => setDays(p.days.toString())}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-400">Modal Awal</p>
                <p className="text-base font-semibold tabular-nums mt-1">{fmt(initialNum)}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-500/30">
              <CardContent className="pt-4">
                <p className="text-xs text-gray-400">Nilai Akhir</p>
                <p className="text-base font-semibold tabular-nums text-emerald-400 mt-1">{fmt(result.finalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-400">Total Profit</p>
                <p className="text-base font-semibold tabular-nums text-emerald-400 mt-1">+{fmt(result.totalGain)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-400">Total Growth</p>
                <p className="text-base font-semibold tabular-nums text-emerald-400 mt-1">
                  +{result.totalGrowthPercent.toFixed(2)}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Grafik Pertumbuhan</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B7280' }} label={{ value: 'Hari', position: 'insideBottom', fill: '#6B7280', fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={v => fmt(v).replace(/\.00$/, '')} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), 'Balance']}
                    labelFormatter={l => `Hari ke-${l}`}
                  />
                  <Line type="monotone" dataKey="endBalance" stroke="#10B981" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Tabel Harian</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-80 sticky-header">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hari</TableHead>
                      <TableHead>Balance Awal</TableHead>
                      <TableHead>Profit Hari Ini</TableHead>
                      <TableHead>Balance Akhir</TableHead>
                      <TableHead>Total Growth</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rows.map(row => (
                      <TableRow key={row.day}>
                        <TableCell className="text-xs text-gray-400">#{row.day}</TableCell>
                        <TableCell className="tabular-nums text-xs">{fmt(row.startBalance)}</TableCell>
                        <TableCell className="tabular-nums text-xs text-emerald-400">+{fmt(row.gainAmount)}</TableCell>
                        <TableCell className="tabular-nums text-xs font-medium">{fmt(row.endBalance)}</TableCell>
                        <TableCell className="tabular-nums text-xs text-emerald-400">+{row.totalGrowthPercent.toFixed(2)}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
