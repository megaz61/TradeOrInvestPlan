'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useWalletStore } from '@/store/walletStore'
import { calculateLeverage, calculateLiquidationPrice, generateLeverageScenarios } from '@/lib/calculations'
import { formatCurrency, formatPercent, getPnLColor } from '@/utils/format'
import type { Currency } from '@/types'

// Grup kecil: spot/micro leverage
const LEVERAGE_SMALL = [0.01, 0.1, 0.5, 1] as const
// Grup besar: leverage tinggi
const LEVERAGE_BIG = [2, 5, 10, 25, 50, 100] as const

function formatLeverage(l: number): string {
  if (l === 1) return '1x (No Lev)'
  if (l < 1) return `${l}x`
  return `${l}x`
}

export default function LeveragePage() {
  const { wallet } = useWalletStore()
  const currency = (wallet?.currency as Currency) ?? 'USD'

  const [capital, setCapital] = useState(wallet?.tradingBalance?.toString() ?? '1000')
  const [leverage, setLeverage] = useState<number>(1)
  const [customLeverage, setCustomLeverage] = useState('')
  const [entryPrice, setEntryPrice] = useState('50000')
  const [stopLoss, setStopLoss] = useState('49000')
  const [takeProfit, setTakeProfit] = useState('52000')
  const [pair, setPair] = useState('BTC/USDT')
  const [isLong, setIsLong] = useState(true)
  const [walletTotal] = useState(wallet?.totalBalance?.toString() ?? '10000')

  function applyCustomLeverage() {
    const v = parseFloat(customLeverage)
    if (v > 0) { setLeverage(v); setCustomLeverage('') }
  }

  const capitalNum = parseFloat(capital) || 0
  const entryNum = parseFloat(entryPrice) || 0
  const slNum = parseFloat(stopLoss) || 0
  const tpNum = parseFloat(takeProfit) || 0
  const walletNum = parseFloat(walletTotal) || 0

  const result = useMemo(() => {
    if (!capitalNum || !entryNum || !slNum) return null
    return calculateLeverage(capitalNum, leverage, entryNum, slNum, tpNum || entryNum * 1.05, isLong, walletNum)
  }, [capitalNum, leverage, entryNum, slNum, tpNum, isLong, walletNum])

  const scenarios = useMemo(() => {
    if (!capitalNum) return []
    return generateLeverageScenarios(capitalNum, leverage, 25)
  }, [capitalNum, leverage])

  const fmt = (v: number) => formatCurrency(v, currency)

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inputs */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Parameter Leverage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Pair / Aset</Label>
              <Input value={pair} onChange={e => setPair(e.target.value)} placeholder="BTC/USDT" />
            </div>
            <div className="space-y-1.5">
              <Label>Modal Trading ({currency})</Label>
              <Input type="number" value={capital} onChange={e => setCapital(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Leverage</Label>
                <span className="text-xs font-semibold text-blue-400">{leverage}x aktif</span>
              </div>

              {/* Grup kecil: spot/micro */}
              <p className="text-[10px] text-gray-500 mb-1">Spot / Micro</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {LEVERAGE_SMALL.map(l => (
                  <Button
                    key={l}
                    size="sm"
                    variant={leverage === l ? 'default' : 'outline'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setLeverage(l)}
                  >
                    {formatLeverage(l)}
                  </Button>
                ))}
              </div>

              {/* Grup besar: leverage tinggi */}
              <p className="text-[10px] text-gray-500 mb-1">Leverage Tinggi</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {LEVERAGE_BIG.map(l => (
                  <Button
                    key={l}
                    size="sm"
                    variant={leverage === l ? 'default' : 'outline'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setLeverage(l)}
                  >
                    {l}x
                  </Button>
                ))}
              </div>

              {/* Custom leverage */}
              <div className="flex gap-1.5 items-center">
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="h-7 text-xs"
                  placeholder="Custom (mis: 3)"
                  value={customLeverage}
                  onChange={e => setCustomLeverage(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyCustomLeverage()}
                />
                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs shrink-0" onClick={applyCustomLeverage}>
                  Set
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={isLong ? 'profit' : 'outline'}
                className="flex-1"
                onClick={() => setIsLong(true)}
              >
                LONG
              </Button>
              <Button
                size="sm"
                variant={!isLong ? 'loss' : 'outline'}
                className="flex-1"
                onClick={() => setIsLong(false)}
              >
                SHORT
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label>Harga Entry</Label>
              <Input type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Stop Loss</Label>
              <Input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Take Profit</Label>
              <Input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="lg:col-span-2 space-y-3">
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400">Total Posisi</p>
                    <p className="text-lg font-semibold tabular-nums mt-1">{fmt(result.positionSize)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{leverage}x leverage · modal {fmt(capitalNum)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400">Margin Digunakan</p>
                    <p className="text-lg font-semibold tabular-nums mt-1">{fmt(result.marginUsed)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">= Modal Trading</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400">Potensi Profit (TP)</p>
                    <p className="text-lg font-semibold tabular-nums text-emerald-400 mt-1">+{fmt(result.potentialProfit)}</p>
                    <p className="text-xs text-emerald-500 mt-0.5">ROI: +{result.roi.toFixed(2)}%</p>
                  </CardContent>
                </Card>
                <Card className="border-red-500/30">
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400">Potensi Loss (SL)</p>
                    <p className="text-lg font-semibold tabular-nums text-red-400 mt-1">-{fmt(result.potentialLoss)}</p>
                    <p className="text-xs text-red-500 mt-0.5">Wallet risk: {result.walletRiskPercent.toFixed(2)}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">Harga Likuidasi</span>
                      <span className="text-red-400 tabular-nums font-mono text-xs">
                        {result.liquidationPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">ROI</span>
                      <span className="text-emerald-400 tabular-nums text-xs">+{result.roi.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">Risk Wallet</span>
                      <span className={`tabular-nums text-xs ${result.walletRiskPercent > 5 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {result.walletRiskPercent.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400 text-xs">Arah</span>
                      <Badge variant={isLong ? 'profit' : 'loss'}>{isLong ? 'LONG' : 'SHORT'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Scenario Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Skenario ±1% s/d ±25%</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto max-h-64 sticky-header">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>%</TableHead>
                          <TableHead>PnL</TableHead>
                          <TableHead>ROI Modal</TableHead>
                          <TableHead>Modal Akhir</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarios.map(s => (
                          <TableRow key={s.percent}>
                            <TableCell className={`font-mono text-xs ${s.percent > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {s.percent > 0 ? '+' : ''}{s.percent}%
                            </TableCell>
                            <TableCell className={`tabular-nums text-xs ${getPnLColor(s.pnl)}`}>
                              {s.pnl > 0 ? '+' : ''}{fmt(s.pnl)}
                            </TableCell>
                            <TableCell className={`tabular-nums text-xs ${getPnLColor(s.pnlPercent)}`}>
                              {s.pnlPercent > 0 ? '+' : ''}{s.pnlPercent.toFixed(2)}%
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">{fmt(s.newCapital)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500 text-sm">
                Isi parameter di sebelah kiri untuk melihat hasil kalkulasi
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
