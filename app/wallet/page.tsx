'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWalletStore } from '@/store/walletStore'
import { formatCurrency, formatPercent } from '@/utils/format'
import { Wallet, TrendingUp, AlertTriangle, Pencil, PlusCircle } from 'lucide-react'
import type { Currency } from '@/types'

const walletSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  currency: z.enum(['USD', 'USDT', 'IDR', 'BTC']),
  totalBalance: z.coerce.number().min(0),
  tradingBalance: z.coerce.number().min(0),
})

type WalletForm = z.infer<typeof walletSchema>

export default function WalletPage() {
  const { wallet, setWallet, isLoading } = useWalletStore()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const form = useForm<WalletForm>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: 'Main Wallet',
      currency: 'USD',
      totalBalance: 0,
      tradingBalance: 0,
    },
  })

  useEffect(() => {
    if (wallet) {
      form.reset({
        name: wallet.name,
        currency: wallet.currency as Currency,
        totalBalance: wallet.totalBalance,
        tradingBalance: wallet.tradingBalance,
      })
    }
  }, [wallet, form])

  async function onSubmit(values: WalletForm) {
    setSaving(true)
    try {
      const res = await fetch('/api/wallet', {
        method: wallet ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wallet ? { id: wallet.id, ...values } : values),
      })
      const data = await res.json()
      if (data.data) {
        setWallet(data.data)
        setOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const freeCapital = wallet
    ? Math.max(0, wallet.totalBalance - (wallet.usedCapital ?? 0))
    : 0
  const capitalUsedPercent = wallet && wallet.totalBalance > 0
    ? ((wallet.usedCapital ?? 0) / wallet.totalBalance) * 100
    : 0
  const riskExposure = wallet && wallet.totalBalance > 0
    ? ((wallet.usedCapital ?? 0) / wallet.totalBalance) * 100
    : 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-200">Wallet Overview</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              {wallet ? 'Edit Wallet' : 'Create Wallet'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{wallet ? 'Edit Wallet' : 'Create Wallet'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nama Wallet</Label>
                <Input {...form.register('name')} placeholder="Main Wallet" />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Mata Uang</Label>
                <Select
                  value={form.watch('currency')}
                  onValueChange={(v) => form.setValue('currency', v as Currency)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD — US Dollar</SelectItem>
                    <SelectItem value="USDT">USDT — Tether</SelectItem>
                    <SelectItem value="IDR">IDR — Rupiah</SelectItem>
                    <SelectItem value="BTC">BTC — Bitcoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Total Wallet (For Invest/Trade)</Label>
                <Input
                  type="number"
                  step="any"
                  {...form.register('totalBalance')}
                  placeholder="10000"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!wallet ? (
        <EmptyState
          icon={Wallet}
          title="Wallet belum dibuat"
          description="Buat wallet untuk mulai melacak modal dan risiko trading kamu."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Buat Wallet
            </Button>
          }
        />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Wallet"
              value={formatCurrency(wallet.totalBalance, wallet.currency as Currency)}
              icon={Wallet}
              iconColor="text-blue-400"
            />
            <StatCard
              title="Modal Terpakai"
              value={formatCurrency(wallet.usedCapital ?? 0, wallet.currency as Currency)}
              subtitle={`${formatPercent(capitalUsedPercent, 1)} terpakai`}
              icon={AlertTriangle}
              iconColor="text-amber-400"
            />
            <StatCard
              title="Sisa / Free Capital"
              value={formatCurrency(freeCapital, wallet.currency as Currency)}
              subtitle={`${formatPercent(Math.max(0, 100 - capitalUsedPercent), 1)} idle`}
              icon={Wallet}
              iconColor="text-gray-400"
            />
            <StatCard
              title="Risk Exposure"
              value={formatPercent(riskExposure, 1)}
              subtitle="dari total wallet"
              icon={AlertTriangle}
              iconColor={riskExposure > 50 ? 'text-red-400' : 'text-yellow-400'}
              valueColor={riskExposure > 50 ? 'text-red-400' : riskExposure > 30 ? 'text-yellow-400' : 'text-emerald-400'}
            />
          </div>

          {/* Detail Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rincian Wallet</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[#1F2937]">
                  <span className="text-xs text-gray-400">Nama Wallet</span>
                  <span className="text-sm font-medium">{wallet.name}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1F2937]">
                  <span className="text-xs text-gray-400">Mata Uang</span>
                  <Badge variant="default">{wallet.currency}</Badge>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1F2937]">
                  <span className="text-xs text-gray-400">Total Wallet</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(wallet.totalBalance, wallet.currency as Currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1F2937]">
                  <span className="text-xs text-gray-400">Modal Terpakai</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-400">
                    {formatCurrency(wallet.usedCapital ?? 0, wallet.currency as Currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#1F2937]">
                  <span className="text-xs text-gray-400">Sisa / Free Capital</span>
                  <span className="text-sm font-semibold tabular-nums text-gray-300">
                    {formatCurrency(freeCapital, wallet.currency as Currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs text-gray-400">% Modal Terpakai</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(capitalUsedPercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatPercent(capitalUsedPercent, 1, false)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Alert */}
          {riskExposure > 50 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>
                    <strong>Risk Exposure tinggi!</strong> Modal trading kamu melebihi 50% dari total wallet.
                    Pertimbangkan untuk mengurangi posisi trading.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
