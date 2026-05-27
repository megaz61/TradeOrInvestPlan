'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/utils/format'
import { Plus, Pencil, Trash2, Eye } from 'lucide-react'
import type { Watchlist } from '@/types'

const schema = z.object({
  symbol: z.string().min(1),
  targetPrice: z.coerce.number().optional(),
  currentNote: z.string().default(''),
  notes: z.string().default(''),
})
type WatchlistForm = z.infer<typeof schema>

export default function WatchlistPage() {
  const [items, setItems] = useState<Watchlist[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Watchlist | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const form = useForm<WatchlistForm>({
    resolver: zodResolver(schema),
    defaultValues: { symbol: '', currentNote: '', notes: '' },
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = search ? `?search=${search}` : ''
      const res = await fetch(`/api/watchlist${params}`)
      const data = await res.json()
      setItems(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchItems() }, [fetchItems])

  function openAdd() {
    setEdit(null)
    form.reset({ symbol: '', currentNote: '', notes: '' })
    setOpen(true)
  }

  function openEdit(item: Watchlist) {
    setEdit(item)
    form.reset({
      symbol: item.symbol,
      targetPrice: item.targetPrice ?? undefined,
      currentNote: item.currentNote,
      notes: item.notes,
    })
    setOpen(true)
  }

  async function onSubmit(values: WatchlistForm) {
    setSaving(true)
    try {
      const res = await fetch('/api/watchlist', {
        method: edit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edit ? { id: edit.id, ...values } : values),
      })
      if (res.ok) {
        setOpen(false)
        fetchItems()
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(id: number) {
    if (!confirm('Hapus dari watchlist?')) return
    await fetch(`/api/watchlist?id=${id}`, { method: 'DELETE' })
    fetchItems()
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Input className="h-8 w-44" placeholder="Cari symbol..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className="ml-auto">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Tambah
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>{edit ? 'Edit Watchlist' : 'Tambah ke Watchlist'}</DialogTitle></DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Symbol *</Label>
                  <Input {...form.register('symbol')} placeholder="BTC, ETH, dll." />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Harga</Label>
                  <Input type="number" step="any" {...form.register('targetPrice')} placeholder="Opsional" />
                </div>
                <div className="space-y-1.5">
                  <Label>Catatan Singkat</Label>
                  <Input {...form.register('currentNote')} placeholder="mis: Tunggu breakout" />
                </div>
                <div className="space-y-1.5">
                  <Label>Analisis / Notes</Label>
                  <Input {...form.register('notes')} placeholder="Detail analisis..." />
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={Eye} title="Watchlist kosong" action={<Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" />Tambah</Button>} />
          ) : (
            <div className="overflow-auto sticky-header">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Target Harga</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead>Ditambah</TableHead>
                    <TableHead className="w-20">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono font-semibold text-blue-400 text-xs">{item.symbol}</TableCell>
                      <TableCell className="tabular-nums text-xs">
                        {item.targetPrice ? item.targetPrice.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-400 max-w-xs truncate">{item.currentNote || item.notes || '—'}</TableCell>
                      <TableCell className="text-xs text-gray-500">{formatDate(item.createdAt)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(item)} className="p-1 hover:text-blue-400 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => deleteItem(item.id)} className="p-1 hover:text-red-400 transition-colors">
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
    </div>
  )
}
