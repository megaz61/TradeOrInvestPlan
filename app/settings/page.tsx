'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSettingsStore } from '@/store/settingsStore'
import type { Currency } from '@/types'

const riskSchema = z.object({
  maxRiskPercent: z.coerce.number().min(0.1).max(100),
  preferredLeverage: z.coerce.number().min(1).max(100),
  maxDrawdown: z.coerce.number().min(1).max(100),
  currency: z.enum(['USD', 'USDT', 'IDR', 'BTC']),
})
type RiskForm = z.infer<typeof riskSchema>

export default function SettingsPage() {
  const { currency, maxRiskPercent, preferredLeverage, maxDrawdown, setCurrency, setRiskSettings } = useSettingsStore()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const form = useForm<RiskForm>({
    resolver: zodResolver(riskSchema),
    defaultValues: {
      maxRiskPercent,
      preferredLeverage,
      maxDrawdown,
      currency,
    },
  })

  async function onSubmit(values: RiskForm) {
    setSaving(true)
    try {
      // Simpan ke store lokal
      setCurrency(values.currency)
      setRiskSettings({
        maxRiskPercent: values.maxRiskPercent,
        preferredLeverage: values.preferredLeverage,
        maxDrawdown: values.maxDrawdown,
      })

      // Simpan ke DB
      await fetch('/api/risk-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Tabs defaultValue="risk">
        <TabsList>
          <TabsTrigger value="risk">Risk & Trading</TabsTrigger>
          <TabsTrigger value="about">Tentang</TabsTrigger>
        </TabsList>

        <TabsContent value="risk">
          <Card>
            <CardHeader><CardTitle className="text-sm">Preferensi Risk & Trading</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Mata Uang Default</Label>
                  <Select value={form.watch('currency')} onValueChange={v => form.setValue('currency', v as Currency)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD — US Dollar</SelectItem>
                      <SelectItem value="USDT">USDT — Tether</SelectItem>
                      <SelectItem value="IDR">IDR — Rupiah Indonesia</SelectItem>
                      <SelectItem value="BTC">BTC — Bitcoin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Max Risk per Trade (%)</Label>
                  <Input type="number" step="0.1" {...form.register('maxRiskPercent')} />
                  <p className="text-xs text-gray-500">Standar: 1–2% dari total wallet per trade</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Leverage Preferred</Label>
                  <Input type="number" min="1" max="100" {...form.register('preferredLeverage')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Drawdown yang Diizinkan (%)</Label>
                  <Input type="number" step="1" {...form.register('maxDrawdown')} />
                  <p className="text-xs text-gray-500">Jika drawdown melebihi ini, pertimbangkan berhenti trading</p>
                </div>
                <Button type="submit" size="sm" disabled={saving}>
                  {saved ? '✓ Tersimpan' : saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader><CardTitle className="text-sm">Tentang Aplikasi</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-400">
              <div className="flex justify-between py-1.5 border-b border-[#1F2937]">
                <span>Nama</span>
                <span className="text-gray-200">Trading & Investment Planner</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1F2937]">
                <span>Versi</span>
                <span className="text-gray-200">1.0.0</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1F2937]">
                <span>Mode</span>
                <span className="text-gray-200">Single User (Local)</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#1F2937]">
                <span>Database</span>
                <span className="text-gray-200">SQLite (Prisma)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span>Stack</span>
                <span className="text-gray-200">Next.js 16 + TypeScript</span>
              </div>
              <div className="mt-4 p-3 bg-[#1F2937] rounded-md text-xs">
                <p className="text-yellow-400 font-medium mb-1">⚠️ Catatan Deployment</p>
                <p>SQLite bersifat ephemeral di Vercel serverless. Untuk deployment production dengan persistensi data, disarankan beralih ke Turso atau PlanetScale.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
