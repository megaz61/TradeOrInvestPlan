import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { calculateFreeCapital, calculateRiskExposure, calculatePortfolioPnL, calculateTradeStats } from '@/lib/calculations'

const DEFAULT_USER_ID = 1

export async function GET() {
  try {
    const [wallet, trades, watchlist, assets] = await Promise.all([
      prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } }),
      prisma.trade.findMany({
        where: { userId: DEFAULT_USER_ID },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.watchlist.findMany({
        where: { userId: DEFAULT_USER_ID },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.asset.findMany({
        where: { userId: DEFAULT_USER_ID },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const tradeStats = calculateTradeStats(trades)
    const recentTrades = trades.slice(0, 10)
    const openTrades = trades.filter(t => t.status === 'open')

    // Active assets (deployed capital)
    const activeAssets = assets.filter(a =>
      ['active', 'partial_take_profit'].includes(a.status)
    )
    const usedCapital = activeAssets.reduce((sum, a) => sum + a.capitalUsed + (a.fee || 0), 0)

    const totalBalance = wallet?.totalBalance ?? 0
    const tradingBalance = wallet?.tradingBalance ?? 0
    const freeCapital = calculateFreeCapital(totalBalance, usedCapital)
    const riskExposure = totalBalance > 0 ? (usedCapital / totalBalance) * 100 : 0

    // Portfolio PnL from assets
    const portfolioPnl = calculatePortfolioPnL(
      assets.map(a => ({ realizedPnl: a.realizedPnl, unrealizedPnl: a.unrealizedPnl }))
    )

    // PnL history (group by date from trades)
    const pnlByDate: Record<string, number> = {}
    for (const trade of trades) {
      if (trade.status === 'closed' && trade.pnl !== null) {
        const date = trade.exitDate
          ? trade.exitDate.toISOString().split('T')[0]
          : trade.createdAt.toISOString().split('T')[0]
        pnlByDate[date] = (pnlByDate[date] ?? 0) + trade.pnl
      }
    }
    const pnlHistory = Object.entries(pnlByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, pnl]) => ({ date, pnl }))

    return NextResponse.json({
      data: {
        totalBalance,
        tradingBalance,
        usedCapital,
        freeCapital,
        riskExposure,
        currency: wallet?.currency ?? 'USD',
        totalPnl: tradeStats.totalPnl,
        portfolioPnl: portfolioPnl.total,
        winRate: tradeStats.winRate,
        activePositions: openTrades.length,
        activeAssets: activeAssets.length,
        openTrades: openTrades.length,
        totalTrades: tradeStats.totalTrades,
        recentTrades,
        watchlistSummary: watchlist,
        pnlHistory,
        stats: {
          winTrades: tradeStats.winTrades,
          lossTrades: tradeStats.lossTrades,
          avgPnl: tradeStats.avgPnl,
          profitFactor: tradeStats.profitFactor,
        },
      },
    })
  } catch (error) {
    console.error('[GET /api/dashboard]', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 })
  }
}
