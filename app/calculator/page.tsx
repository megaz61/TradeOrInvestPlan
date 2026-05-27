'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useWalletStore } from '@/store/walletStore'
import { calculateRiskManagement, calculateFee, simulateBacktest, generateProfitTable, generateLossTable } from '@/lib/calculations'
import { formatCurrency, formatPercent, formatNumber } from '@/utils/format'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { Currency } from '@/types'

export default function CalculatorPage() {
  const { wallet } = useWalletStore()
  const currency = (wallet?.currency as Currency) ?? 'USD'
  const fmt = (v: number) => formatCurrency(v, currency)

  // Risk Calculator
  const [rWallet, setRWallet] = useState(wallet?.totalBalance?.toString() ?? '10000')
  const [rRiskPct, setRRiskPct] = useState('2')
  const [rEntry, setREntry] = useState('50000')
  const [rSL, setRSL] = useState('49000')
  const [rTP, setRTP] = useState('52000')
  const [rLeverage, setRLeverage] = useState('1')

  const riskResult = useMemo(() => {
    const w = parseFloat(rWallet) || 0
    const r = parseFloat(rRiskPct) || 2
    const e = parseFloat(rEntry) || 0
    const sl = parseFloat(rSL) || 0
    const tp = parseFloat(rTP) || 0
    const lev = parseFloat(rLeverage) || 1
    if (!w || !e || !sl) return null
    return calculateRiskManagement(w, r, e, sl, tp, lev)
  }, [rWallet, rRiskPct, rEntry, rSL, rTP, rLeverage])

  // Fee Calculator
  const [fPosition, setFPosition] = useState('1000')
  const [fMaker, setFMaker] = useState('0.02')
  const [fTaker, setFTaker] = useState('0.05')
  const [fIsMarket, setFIsMarket] = useState(true)
  const [fRounds, setFRounds] = useState('1')

  const feeResult = useMemo(() => {
    const pos = parseFloat(fPosition) || 0
    const maker = parseFloat(fMaker) || 0.02
    const taker = parseFloat(fTaker) || 0.05
    const rounds = parseInt(fRounds) || 1
    if (!pos) return null
    const singleFee = calculateFee(pos, maker, taker, fIsMarket)
    return {
      ...singleFee,
      totalFee: singleFee.fee * rounds,
      rounds,
    }
  }, [fPosition, fMaker, fTaker, fIsMarket, fRounds])

  // Backtest
  const [bWinrate, setBWinrate] = useState('55')
  const [bRR, setBRR] = useState('2')
  const [bTrades, setBTrades] = useState('100')
  const [bCapital, setBCapital] = useState(wallet?.tradingBalance?.toString() ?? '1000')
  const [bRiskPct, setBRiskPct] = useState('2')

  const backtestResult = useMemo(() => {
    const wr = parseFloat(bWinrate) || 55
    const rr = parseFloat(bRR) || 2
    const n = parseInt(bTrades) || 100
    const cap = parseFloat(bCapital) || 1000
    const rp = parseFloat(bRiskPct) || 2
    return simulateBacktest(wr, rr, n, cap, rp)
  }, [bWinrate, bRR, bTrades, bCapital, bRiskPct])

  return (
    <div className="space-y-4 max-w-4xl">
      <Tabs defaultValue="risk">
        <TabsList>
          <TabsTrigger value="risk">Risk Calculator</TabsTrigger>
          <TabsTrigger value="fee">Fee Calculator</TabsTrigger>
          <TabsTrigger value="backtest">Backtest</TabsTrigger>
          <TabsTrigger value="pnltable">Tabel PnL</TabsTrigger>
        </TabsList>

        {/* RISK CALCULATOR */}
        <TabsContent value="risk">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Parameter</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Dana (Total Wallet (For Invest/Trade))</Label>
                    <Input type="number" value={rWallet} onChange={e => setRWallet(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Risk per Trade (%)</Label>
                    <Input type="number" value={rRiskPct} onChange={e => setRRiskPct(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Harga Entry</Label>
                    <Input type="number" value={rEntry} onChange={e => setREntry(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Stop Loss</Label>
                    <Input type="number" value={rSL} onChange={e => setRSL(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Take Profit</Label>
                    <Input type="number" value={rTP} onChange={e => setRTP(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Leverage</Label>
                    <Input type="number" value={rLeverage} onChange={e => setRLeverage(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Hasil Kalkulasi</CardTitle></CardHeader>
              <CardContent>
                {riskResult ? (
                  <div className="space-y-3">
                    <Row label="Max Loss per Trade" value={fmt(riskResult.maxLossAmount)} color="text-red-400" />
                    <Row label="Posisi yang Aman" value={fmt(riskResult.recommendedPositionSize)} color="text-blue-400" />
                    <Row label="Safe Leverage" value={`${riskResult.safeLeverage.toFixed(2)}x`} />
                    <Row label="Risk/Reward Ratio"
                      value={riskResult.riskRewardRatio > 0 ? `1 : ${riskResult.riskRewardRatio.toFixed(2)}` : '—'}
                      color={riskResult.riskRewardRatio >= 2 ? 'text-emerald-400' : 'text-yellow-400'}
                    />
                    <Row label="SL Distance" value={formatPercent(riskResult.stopLossPercent, 2, false)} color="text-red-400" />
                    <Row
                      label="Trade rugi sebelum -20% DD"
                      value={`${Math.floor(riskResult.estimatedDrawdown)} trade`}
                      color="text-yellow-400"
                    />

                    {riskResult.riskRewardRatio < 1.5 && riskResult.riskRewardRatio > 0 && (
                      <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-xs text-yellow-400">
                        ⚠️ Risk/Reward ratio rendah (&lt;1.5). Disarankan minimal 1:2.
                      </div>
                    )}
                    {riskResult.riskRewardRatio >= 2 && (
                      <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-400">
                        ✓ Risk/Reward ratio bagus (≥1:2).
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Isi parameter untuk melihat hasil</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* FEE CALCULATOR */}
        <TabsContent value="fee">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Parameter Fee</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Ukuran Posisi</Label>
                  <Input type="number" value={fPosition} onChange={e => setFPosition(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Maker Fee (%)</Label>
                    <Input type="number" step="0.001" value={fMaker} onChange={e => setFMaker(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Taker Fee (%)</Label>
                    <Input type="number" step="0.001" value={fTaker} onChange={e => setFTaker(e.target.value)} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={fIsMarket ? 'default' : 'outline'} onClick={() => setFIsMarket(true)}>
                    Market (Taker)
                  </Button>
                  <Button size="sm" variant={!fIsMarket ? 'default' : 'outline'} onClick={() => setFIsMarket(false)}>
                    Limit (Maker)
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label>Jumlah Round Trip</Label>
                  <Input type="number" min="1" value={fRounds} onChange={e => setFRounds(e.target.value)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Hasil Fee</CardTitle></CardHeader>
              <CardContent>
                {feeResult ? (
                  <div className="space-y-3">
                    <Row label="Fee Rate" value={`${feeResult.feePercent}%`} />
                    <Row label="Fee per Trade" value={fmt(feeResult.fee)} color="text-red-400" />
                    <Row label="Total Fee ({fRounds}x)" value={fmt(feeResult.totalFee)} color="text-red-400" />
                    <Row label="Net Posisi" value={fmt(feeResult.netPosition)} color="text-emerald-400" />
                    <div className="mt-3 p-2 bg-[#1F2937] rounded-md text-xs text-gray-400">
                      Untuk breakeven, trade harus profit minimal{' '}
                      <strong className="text-gray-200">{formatPercent(feeResult.feePercent * 2, 3, false)}</strong>{' '}
                      (open + close).
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Isi parameter untuk melihat hasil</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* BACKTEST */}
        <TabsContent value="backtest">
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Backtest Strategi</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label>Win Rate (%)</Label>
                    <Input type="number" value={bWinrate} onChange={e => setBWinrate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Risk/Reward Ratio</Label>
                    <Input type="number" step="0.1" value={bRR} onChange={e => setBRR(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jumlah Trade</Label>
                    <Input type="number" value={bTrades} onChange={e => setBTrades(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Dana Awal</Label>
                    <Input type="number" value={bCapital} onChange={e => setBCapital(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Risk per Trade (%)</Label>
                    <Input type="number" value={bRiskPct} onChange={e => setBRiskPct(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {backtestResult && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-400">Win/Loss</p>
                      <p className="text-lg font-semibold mt-1">
                        <span className="text-emerald-400">{backtestResult.wins}</span>
                        <span className="text-gray-500 mx-1">/</span>
                        <span className="text-red-400">{backtestResult.losses}</span>
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-400">Return</p>
                      <p className={`text-lg font-semibold mt-1 ${backtestResult.expectedReturn > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {backtestResult.expectedReturn > 0 ? '+' : ''}{backtestResult.expectedReturn.toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-400">Max Drawdown</p>
                      <p className="text-lg font-semibold text-red-400 mt-1">-{backtestResult.maxDrawdown.toFixed(2)}%</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-gray-400">Final Capital</p>
                      <p className={`text-lg font-semibold mt-1 ${backtestResult.finalCapital > parseFloat(bCapital) ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmt(backtestResult.finalCapital)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Equity Curve</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={backtestResult.equityCurve}>
                        <XAxis dataKey="trade" tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={v => `${(v/1000).toFixed(1)}K`} />
                        <Tooltip
                          contentStyle={{ background: '#111827', border: '1px solid #1F2937', borderRadius: 6 }}
                          formatter={(v: number) => [fmt(v), 'Capital']}
                        />
                        <ReferenceLine y={parseFloat(bCapital)} stroke="#374151" strokeDasharray="3 3" />
                        <Line type="monotone" dataKey="capital" stroke="#3B82F6" dot={false} strokeWidth={1.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
        {/* PNL TABLE */}
        <TabsContent value="pnltable">
          <PnLTableTab fmt={fmt} wallet={wallet} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#1F2937] last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color ?? 'text-gray-200'}`}>{value}</span>
    </div>
  )
}

// ─── PnL Table Tab ──────────────────────────────────────────────────────────
import type { Wallet } from '@/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow as TRow } from '@/components/ui/table'

function PnLTableTab({ fmt, wallet }: { fmt: (v: number) => string; wallet: Wallet | null }) {
  const [pCapital, setPCapital] = useState(wallet?.tradingBalance?.toString() ?? '1000')
  const [pWallet, setPWallet] = useState(wallet?.totalBalance?.toString() ?? '10000')
  const [pMax, setPMax] = useState('100')
  const [activeTab, setActiveTab] = useState<'profit' | 'loss'>('profit')

  const capital = parseFloat(pCapital) || 0
  const walletTotal = parseFloat(pWallet) || 0
  const maxPct = Math.min(Math.max(parseInt(pMax) || 100, 10), 1000)

  const profitRows = useMemo(() => capital > 0 ? generateProfitTable(capital, walletTotal, maxPct) : [], [capital, walletTotal, maxPct])
  const lossRows = useMemo(() => capital > 0 ? generateLossTable(capital, walletTotal) : [], [capital, walletTotal])

  const rows = activeTab === 'profit' ? profitRows : lossRows

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Dana Trading</Label>
              <Input type="number" value={pCapital} onChange={e => setPCapital(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Total Wallet (For Invest/Trade)</Label>
              <Input type="number" value={pWallet} onChange={e => setPWallet(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Maks Profit % (tabel)</Label>
              <Input type="number" min="10" max="1000" value={pMax} onChange={e => setPMax(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button
                size="sm" className="flex-1"
                variant={activeTab === 'profit' ? 'default' : 'outline'}
                onClick={() => setActiveTab('profit')}
              >Profit</Button>
              <Button
                size="sm" className="flex-1"
                variant={activeTab === 'loss' ? 'default' : 'outline'}
                onClick={() => setActiveTab('loss')}
              >Loss</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[50vh] sticky-header">
            <Table>
              <TableHeader>
                <TRow>
                  <TableHead>%</TableHead>
                  <TableHead>Dana Baru</TableHead>
                  <TableHead>Perubahan</TableHead>
                  <TableHead>Wallet Baru</TableHead>
                  <TableHead>Growth Wallet</TableHead>
                </TRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TRow key={r.percent}>
                    <TableCell className={`font-mono text-xs ${r.percent > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.percent > 0 ? '+' : ''}{r.percent}%
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{fmt(r.newCapital)}</TableCell>
                    <TableCell className={`tabular-nums text-xs ${r.nominalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.nominalChange >= 0 ? '+' : ''}{fmt(r.nominalChange)}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs">{fmt(r.newWallet)}</TableCell>
                    <TableCell className={`tabular-nums text-xs ${r.walletGrowthPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.walletGrowthPercent >= 0 ? '+' : ''}{r.walletGrowthPercent.toFixed(3)}%
                    </TableCell>
                  </TRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

