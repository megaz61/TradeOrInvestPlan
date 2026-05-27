import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_USER_ID = 1

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const emotion = searchParams.get('emotion')
    const symbol = searchParams.get('symbol')
    const limit = searchParams.get('limit')

    const trades = await prisma.trade.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        ...(status && status !== 'all' && { status }),
        ...(emotion && emotion !== 'all' && { emotion }),
        ...(symbol && { symbol: { contains: symbol } }),
      },
      include: { journal: true, asset: true },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit) }),
    })

    return NextResponse.json({ data: trades })
  } catch (error) {
    console.error('[GET /api/trades]', error)
    return NextResponse.json({ error: 'Failed to fetch trades' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      symbol, assetId, entryPrice, exitPrice,
      entryDate, exitDate, entryAmount, leverage,
      positionSize, pnl, pnlPercent,
      emotion, notes, strategy, status
    } = body

    const parsedPnl = pnl !== undefined && pnl !== null ? parseFloat(pnl) : null
    let finalAssetId = assetId ? parseInt(assetId) : null

    // ── Auto-create Asset if not linked
    if (!finalAssetId) {
      const newAssetStatus = status === 'open' 
        ? 'active' 
        : (parsedPnl !== null && parsedPnl >= 0 ? 'closed_profit' : 'closed_loss')

      const parsedAmount = parseFloat(entryAmount || 0)
      const parsedEntryPrice = parseFloat(entryPrice || 0)
      const parsedLeverage = parseFloat(leverage || 1)
      const assetVolume = parsedEntryPrice > 0 ? parsedAmount / parsedEntryPrice : 0

      const asset = await prisma.asset.create({
        data: {
          userId: DEFAULT_USER_ID,
          symbol: symbol?.toUpperCase() || '',
          name: symbol?.toUpperCase() || '',
          assetType: body.assetType ?? 'Crypto',
          platform: body.platform ?? '',
          entryPrice: parsedEntryPrice,
          capitalUsed: parsedAmount,
          leverage: parsedLeverage,
          volume: assetVolume,
          status: newAssetStatus,
          notes: notes ?? '',
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          realizedPnl: status === 'closed' && parsedPnl !== null ? parsedPnl : 0,
          currentCapital: parsedAmount + (status === 'closed' && parsedPnl !== null ? parsedPnl : 0),
        }
      })
      finalAssetId = asset.id

      // Auto-create entry event
      if (parsedAmount > 0) {
        await prisma.assetEvent.create({
          data: {
            assetId: asset.id,
            eventType: 'entry',
            price: parsedEntryPrice,
            volume: assetVolume,
            capitalBefore: 0,
            capitalAfter: parsedAmount,
            pnlRealized: 0,
            notes: 'Posisi dibuka via Jurnal',
          }
        })
      }

      // If closed, also create close event
      if (status === 'closed' && parsedPnl !== null) {
        await prisma.assetEvent.create({
          data: {
            assetId: asset.id,
            eventType: 'close',
            price: exitPrice ? parseFloat(exitPrice) : parsedEntryPrice,
            volume: assetVolume,
            capitalBefore: parsedAmount,
            capitalAfter: parsedAmount + parsedPnl,
            pnlRealized: parsedPnl,
            notes: 'Posisi ditutup via Jurnal',
          }
        })
      }
    }

    const trade = await prisma.trade.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: symbol?.toUpperCase(),
        assetId: finalAssetId,
        entryPrice: parseFloat(entryPrice),
        exitPrice: exitPrice ? parseFloat(exitPrice) : null,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        exitDate: exitDate ? new Date(exitDate) : null,
        entryAmount: parseFloat(entryAmount || 0),
        leverage: parseFloat(leverage || 1),
        positionSize: parseFloat(positionSize || 0),
        pnl: parsedPnl,
        pnlPercent: pnlPercent !== undefined && pnlPercent !== null ? parseFloat(pnlPercent) : null,
        emotion: emotion ?? 'Neutral',
        notes: notes ?? '',
        strategy: strategy ?? '',
        status: status ?? 'open',
      },
      include: { journal: true },
    })

    // Auto-update wallet if trade is closed with PnL
    if (status === 'closed' && parsedPnl !== null) {
      const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
      if (wallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            totalBalance: wallet.totalBalance + parsedPnl,
            tradingBalance: Math.max(0, wallet.tradingBalance + parsedPnl),
          },
        })
      }
    }

    return NextResponse.json({ data: trade }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/trades]', error)
    return NextResponse.json({ error: 'Failed to create trade' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...fields } = body

    // Get old trade to check status change
    const oldTrade = await prisma.trade.findUnique({ where: { id: parseInt(id) } })
    if (!oldTrade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })

    const parsedPnl = fields.pnl !== undefined && fields.pnl !== null ? parseFloat(fields.pnl) : undefined

    const trade = await prisma.trade.update({
      where: { id: parseInt(id) },
      data: {
        ...(fields.exitPrice !== undefined && { exitPrice: parseFloat(fields.exitPrice) }),
        ...(fields.exitDate && { exitDate: new Date(fields.exitDate) }),
        ...(parsedPnl !== undefined && { pnl: parsedPnl }),
        ...(fields.pnlPercent !== undefined && { pnlPercent: parseFloat(fields.pnlPercent) }),
        ...(fields.emotion && { emotion: fields.emotion }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.strategy !== undefined && { strategy: fields.strategy }),
        ...(fields.status && { status: fields.status }),
        ...(fields.leverage !== undefined && { leverage: parseFloat(fields.leverage) }),
        ...(fields.positionSize !== undefined && { positionSize: parseFloat(fields.positionSize) }),
        ...(fields.entryAmount !== undefined && { entryAmount: parseFloat(fields.entryAmount) }),
        ...(fields.entryPrice !== undefined && { entryPrice: parseFloat(fields.entryPrice) }),
        ...(fields.symbol !== undefined && { symbol: fields.symbol.toUpperCase() }),
      },
      include: { journal: true },
    })

    // Auto-update wallet when trade changes to 'closed'
    const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
    if (wallet) {
      const wasOpen = oldTrade.status === 'open'
      const isNowClosed = fields.status === 'closed'

      if (wasOpen && isNowClosed && parsedPnl !== undefined) {
        // Newly closed: add PnL to wallet
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            totalBalance: wallet.totalBalance + parsedPnl,
            tradingBalance: Math.max(0, wallet.tradingBalance + parsedPnl),
          },
        })
      } else if (!wasOpen && isNowClosed && parsedPnl !== undefined && oldTrade.pnl !== null) {
        // Already closed but PnL changed: update by difference
        const diff = parsedPnl - oldTrade.pnl
        if (diff !== 0) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: {
              totalBalance: wallet.totalBalance + diff,
              tradingBalance: Math.max(0, wallet.tradingBalance + diff),
            },
          })
        }
      }
    }

    // ── Sync to Asset
    const oldAssetId = oldTrade.assetId
    if (oldAssetId) {
      const isNowClosed = fields.status === 'closed' || (fields.status === undefined && oldTrade.status === 'closed')
      const wasOpen = oldTrade.status === 'open'
      
      const newCapital = fields.entryAmount !== undefined ? parseFloat(fields.entryAmount) : oldTrade.entryAmount
      const newLeverage = fields.leverage !== undefined ? parseFloat(fields.leverage) : oldTrade.leverage
      const newEntryPrice = fields.entryPrice !== undefined ? parseFloat(fields.entryPrice) : oldTrade.entryPrice
      const newExitPrice = fields.exitPrice !== undefined && fields.exitPrice !== null ? parseFloat(fields.exitPrice) : oldTrade.exitPrice
      const newSymbol = fields.symbol !== undefined ? fields.symbol.toUpperCase() : oldTrade.symbol

      let newPnl = parsedPnl !== undefined ? parsedPnl : oldTrade.pnl

      // Auto-calculate PnL if needed and status is closed
      if (isNowClosed && newPnl === null && newExitPrice !== null && newEntryPrice > 0) {
        const diff = newExitPrice - newEntryPrice
        newPnl = newCapital * newLeverage * (diff / newEntryPrice)
      }

      const assetStatus = isNowClosed 
        ? (newPnl !== null && newPnl >= 0 ? 'closed_profit' : 'closed_loss') 
        : 'active'

      const asset = await prisma.asset.findUnique({ where: { id: oldAssetId } })
      const assetFee = asset?.fee || 0
      const baseCapital = Math.max(0, newCapital - assetFee)

      await prisma.asset.update({
        where: { id: oldAssetId },
        data: {
          symbol: newSymbol,
          capitalUsed: baseCapital,
          leverage: newLeverage,
          entryPrice: newEntryPrice,
          volume: newEntryPrice > 0 ? baseCapital / newEntryPrice : 0,
          status: assetStatus,
          realizedPnl: isNowClosed && newPnl !== null ? newPnl : 0,
          currentCapital: baseCapital + (isNowClosed && newPnl !== null ? newPnl : 0),
        }
      })

      // Sync AssetEvents
      if (wasOpen && fields.status === 'closed' && newPnl !== null) {
        // Newly closed: create close event
        await prisma.assetEvent.create({
          data: {
            assetId: oldAssetId,
            eventType: 'close',
            price: newExitPrice ?? newEntryPrice,
            volume: newEntryPrice > 0 ? newCapital / newEntryPrice : 0,
            capitalBefore: newCapital,
            capitalAfter: newCapital + newPnl,
            pnlRealized: newPnl,
            notes: 'Posisi ditutup via Jurnal (Update)',
          }
        })
      } else if (!wasOpen && fields.status === 'open') {
        // Reopened: delete close event
        await prisma.assetEvent.deleteMany({
          where: { assetId: oldAssetId, eventType: { in: ['close', 'liquidation'] } }
        })
      }
    }

    return NextResponse.json({ data: trade })
  } catch (error) {
    console.error('[PATCH /api/trades]', error)
    return NextResponse.json({ error: 'Failed to update trade' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const trade = await prisma.trade.findUnique({ where: { id: parseInt(id) } })
    if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 })

    const assetId = trade.assetId

    // 1. Reverse wallet PnL if trade was closed
    if (trade.status === 'closed' && trade.pnl !== null && trade.pnl !== 0) {
      const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
      if (wallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            totalBalance: wallet.totalBalance - trade.pnl,
            tradingBalance: Math.max(0, wallet.tradingBalance - trade.pnl),
          },
        })
      }
    }

    // 2. Delete trade journal & trade
    await prisma.tradeJournal.deleteMany({ where: { tradeId: parseInt(id) } })
    await prisma.trade.delete({ where: { id: parseInt(id) } })

    // 3. Handle asset sync or deletion
    if (assetId) {
      const otherTrades = await prisma.trade.findMany({ where: { assetId } })
      if (otherTrades.length === 0) {
        await prisma.asset.delete({ where: { id: assetId } })
      } else {
        // Update asset PnL from remaining closed trades
        const remainingClosed = otherTrades.filter(t => t.status === 'closed' && t.pnl !== null)
        const newRealizedPnl = remainingClosed.reduce((sum, t) => sum + (t.pnl ?? 0), 0)
        
        const openTrades = otherTrades.filter(t => t.status === 'open')
        const asset = await prisma.asset.findUnique({ where: { id: assetId } })
        if (asset) {
          const newStatus = openTrades.length > 0 
            ? 'active' 
            : (newRealizedPnl >= 0 ? 'closed_profit' : 'closed_loss')

          await prisma.asset.update({
            where: { id: assetId },
            data: {
              realizedPnl: newRealizedPnl,
              currentCapital: asset.capitalUsed + newRealizedPnl,
              status: newStatus,
            }
          })
        }
      }
    }

    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[DELETE /api/trades]', error)
    return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 })
  }
}
