import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const DEFAULT_USER_ID = 1

// Helper: hitung usedCapital dari active assets secara real-time
async function computeUsedCapital(): Promise<number> {
  const activeAssets = await prisma.asset.findMany({
    where: {
      userId: DEFAULT_USER_ID,
      status: { in: ['active', 'partial_take_profit'] },
    },
    select: { capitalUsed: true, fee: true },
  })
  return activeAssets.reduce((sum, a) => sum + a.capitalUsed + (a.fee || 0), 0)
}

// GET /api/wallet
export async function GET() {
  try {
    const [wallet, usedCapital] = await Promise.all([
      prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID }, orderBy: { createdAt: 'asc' } }),
      computeUsedCapital(),
    ])

    if (!wallet) return NextResponse.json({ data: null })

    const freeCapital = Math.max(0, wallet.totalBalance - usedCapital)

    return NextResponse.json({
      data: { ...wallet, usedCapital, freeCapital },
    })
  } catch (error) {
    console.error('[GET /api/wallet]', error)
    return NextResponse.json({ error: 'Failed to fetch wallet' }, { status: 500 })
  }
}

// POST /api/wallet
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, currency, totalBalance, tradingBalance } = body

    const wallet = await prisma.wallet.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: name ?? 'Main Wallet',
        currency: currency ?? 'USD',
        totalBalance: parseFloat(totalBalance) || 0,
        tradingBalance: parseFloat(tradingBalance) || 0,
      },
    })

    const usedCapital = await computeUsedCapital()
    return NextResponse.json({ data: { ...wallet, usedCapital, freeCapital: wallet.totalBalance - usedCapital } }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/wallet]', error)
    return NextResponse.json({ error: 'Failed to create wallet' }, { status: 500 })
  }
}

// PATCH /api/wallet
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, name, currency, totalBalance, tradingBalance } = body

    const wallet = await prisma.wallet.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name }),
        ...(currency !== undefined && { currency }),
        ...(totalBalance !== undefined && { totalBalance: parseFloat(totalBalance) }),
        ...(tradingBalance !== undefined && { tradingBalance: parseFloat(tradingBalance) }),
      },
    })

    const usedCapital = await computeUsedCapital()
    return NextResponse.json({ data: { ...wallet, usedCapital, freeCapital: Math.max(0, wallet.totalBalance - usedCapital) } })
  } catch (error) {
    console.error('[PATCH /api/wallet]', error)
    return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 })
  }
}
