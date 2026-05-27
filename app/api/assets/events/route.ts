import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_USER_ID = 1

// GET /api/assets/events?assetId=X
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const assetId = searchParams.get('assetId')
    if (!assetId) return NextResponse.json({ error: 'assetId required' }, { status: 400 })

    const events = await prisma.assetEvent.findMany({
      where: { assetId: parseInt(assetId) },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ data: events })
  } catch (error) {
    console.error('[GET /api/assets/events]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// POST /api/assets/events — add event, recalculate asset
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { assetId, eventType, price, volume, pnlRealized, notes } = body

    const asset = await prisma.asset.findUnique({ where: { id: parseInt(assetId) } })
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const capitalBefore = asset.currentCapital
    const pnl = parseFloat(pnlRealized) || 0
    const capitalAfter = capitalBefore + pnl

    const event = await prisma.assetEvent.create({
      data: {
        assetId: parseInt(assetId),
        eventType: eventType ?? 'add',
        price: parseFloat(price) || 0,
        volume: parseFloat(volume) || 0,
        capitalBefore,
        capitalAfter,
        pnlRealized: pnl,
        notes: notes ?? '',
      },
    })

    // Recalculate asset totals
    const allEvents = await prisma.assetEvent.findMany({ where: { assetId: parseInt(assetId) } })
    const totalRealizedPnl = allEvents.reduce((sum, e) => sum + e.pnlRealized, 0)

    // Determine new status
    let newStatus = asset.status
    if (eventType === 'close') newStatus = pnl >= 0 ? 'closed_profit' : 'closed_loss'
    if (eventType === 'liquidation') newStatus = 'liquidated'

    await prisma.asset.update({
      where: { id: parseInt(assetId) },
      data: {
        currentCapital: capitalAfter,
        realizedPnl: totalRealizedPnl,
        status: newStatus,
      },
    })

    // Wallet update
    const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
    if (wallet && pnl !== 0) {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          totalBalance: wallet.totalBalance + pnl,
          tradingBalance: Math.max(0, wallet.tradingBalance + pnl),
        },
      })
    }

    return NextResponse.json({ data: event }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/assets/events]', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
