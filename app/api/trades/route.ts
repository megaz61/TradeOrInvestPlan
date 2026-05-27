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
      emotion, notes, strategy, status,
      actionType
    } = body

    const parsedActionType = actionType ?? 'entry'
    const parsedEntry = parseFloat(entryPrice) || 0
    const parsedAmount = parseFloat(entryAmount) || 0
    const parsedLeverage = parseFloat(leverage) || 1
    const parsedPositionSize = parseFloat(positionSize) || (parsedAmount * parsedLeverage)

    let parsedExit = (exitPrice !== undefined && exitPrice !== null && exitPrice !== '') ? parseFloat(exitPrice) : null
    let parsedPnl = (pnl !== undefined && pnl !== null && pnl !== '') ? parseFloat(pnl) : null
    let parsedPnlPercent = (pnlPercent !== undefined && pnlPercent !== null && pnlPercent !== '') ? parseFloat(pnlPercent) : null

    if (parsedActionType === 'liquidation') {
      parsedPnl = -parsedAmount
      parsedPnlPercent = -100
      parsedExit = parsedLeverage > 1 ? parsedEntry * (1 - 1 / parsedLeverage) : 0
    }

    let finalAssetId = assetId ? parseInt(assetId) : null

    // ── Handle updates to the selected existing asset based on actionType
    if (finalAssetId) {
      const asset = await prisma.asset.findUnique({ where: { id: finalAssetId } })
      if (asset) {
        if (parsedActionType === 'add') {
          // Tambah Modal (Scale In)
          const newCapitalUsed = asset.capitalUsed + parsedAmount
          await prisma.asset.update({
            where: { id: finalAssetId },
            data: {
              capitalUsed: newCapitalUsed,
              currentCapital: asset.currentCapital + parsedAmount,
              status: 'active',
            }
          })
          // Log event
          await prisma.assetEvent.create({
            data: {
              assetId: finalAssetId,
              eventType: 'add',
              price: parsedEntry,
              volume: parsedEntry > 0 ? parsedAmount / parsedEntry : 0,
              capitalBefore: asset.currentCapital,
              capitalAfter: asset.currentCapital + parsedAmount,
              pnlRealized: 0,
              notes: notes ?? 'Tambah modal via Jurnal',
            }
          })
        } else if (parsedActionType === 'reduce') {
          // Kurangi Modal (Scale Out)
          const newCapitalUsed = Math.max(0, asset.capitalUsed - parsedAmount)
          await prisma.asset.update({
            where: { id: finalAssetId },
            data: {
              capitalUsed: newCapitalUsed,
              currentCapital: Math.max(0, asset.currentCapital - parsedAmount),
            }
          })
          // Log event
          await prisma.assetEvent.create({
            data: {
              assetId: finalAssetId,
              eventType: 'reduce',
              price: parsedEntry,
              volume: parsedEntry > 0 ? parsedAmount / parsedEntry : 0,
              capitalBefore: asset.currentCapital,
              capitalAfter: Math.max(0, asset.currentCapital - parsedAmount),
              pnlRealized: 0,
              notes: notes ?? 'Kurangi modal via Jurnal',
            }
          })
        } else if (parsedActionType === 'realize_pnl') {
          // Realisasi Profit/Loss (Aset Tetap Aktif)
          const pnlVal = parsedPnl || 0
          const newAssetStatus = pnlVal > 0 ? 'partial_take_profit' : asset.status
          await prisma.asset.update({
            where: { id: finalAssetId },
            data: {
              realizedPnl: asset.realizedPnl + pnlVal,
              currentCapital: Math.max(0, asset.currentCapital + pnlVal),
              status: newAssetStatus,
            }
          })
          // Log event
          await prisma.assetEvent.create({
            data: {
              assetId: finalAssetId,
              eventType: 'pnl_running',
              price: parsedExit || parsedEntry,
              volume: 0,
              capitalBefore: asset.currentCapital,
              capitalAfter: Math.max(0, asset.currentCapital + pnlVal),
              pnlRealized: pnlVal,
              notes: notes ?? 'Realisasi PnL berjalan via Jurnal',
            }
          })
        } else if (['close', 'cut_loss', 'liquidation'].includes(parsedActionType)) {
          // Tutup Posisi / Cut Loss / Likuidasi
          const pnlVal = parsedPnl || 0
          const finalStatus = parsedActionType === 'liquidation'
            ? 'liquidated'
            : (pnlVal >= 0 ? 'closed_profit' : 'closed_loss')

          await prisma.asset.update({
            where: { id: finalAssetId },
            data: {
              status: finalStatus,
              realizedPnl: asset.realizedPnl + pnlVal,
              currentCapital: asset.capitalUsed + asset.realizedPnl + pnlVal,
            }
          })
          // Log event
          await prisma.assetEvent.create({
            data: {
              assetId: finalAssetId,
              eventType: parsedActionType === 'liquidation' ? 'liquidation' : 'close',
              price: parsedExit || parsedEntry,
              volume: asset.volume,
              capitalBefore: asset.currentCapital,
              capitalAfter: asset.capitalUsed + asset.realizedPnl + pnlVal,
              pnlRealized: pnlVal,
              notes: notes ?? `Posisi ditutup (${parsedActionType}) via Jurnal`,
            }
          })

          // Update any other open trades for this asset
          await prisma.trade.updateMany({
            where: { assetId: finalAssetId, status: 'open' },
            data: {
              status: 'closed',
              exitPrice: parsedExit,
              exitDate: exitDate ? new Date(exitDate) : new Date(),
              pnl: 0,
              pnlPercent: 0,
            }
          })
        }
      }
    } else {
      // ── Auto-create Asset if not linked (Backwards compatibility, though UI enforces it now)
      const newAssetStatus = ['close', 'cut_loss', 'liquidation', 'reduce'].includes(parsedActionType)
        ? (parsedPnl !== null && parsedPnl >= 0 ? 'closed_profit' : 'closed_loss')
        : 'active'

      const assetVolume = parsedEntry > 0 ? parsedAmount / parsedEntry : 0

      const asset = await prisma.asset.create({
        data: {
          userId: DEFAULT_USER_ID,
          symbol: symbol?.toUpperCase() || '',
          name: symbol?.toUpperCase() || '',
          assetType: body.assetType ?? 'Crypto',
          platform: body.platform ?? '',
          entryPrice: parsedEntry,
          capitalUsed: parsedAmount,
          leverage: parsedLeverage,
          volume: assetVolume,
          status: newAssetStatus,
          notes: notes ?? '',
          entryDate: entryDate ? new Date(entryDate) : new Date(),
          realizedPnl: ['close', 'cut_loss', 'liquidation', 'reduce'].includes(parsedActionType) && parsedPnl !== null ? parsedPnl : 0,
          currentCapital: parsedAmount + (['close', 'cut_loss', 'liquidation', 'reduce'].includes(parsedActionType) && parsedPnl !== null ? parsedPnl : 0),
        }
      })
      finalAssetId = asset.id

      if (parsedAmount > 0) {
        await prisma.assetEvent.create({
          data: {
            assetId: asset.id,
            eventType: 'entry',
            price: parsedEntry,
            volume: assetVolume,
            capitalBefore: 0,
            capitalAfter: parsedAmount,
            pnlRealized: 0,
            notes: 'Posisi dibuka via Jurnal',
          }
        })
      }

      if (['close', 'cut_loss', 'liquidation', 'reduce'].includes(parsedActionType) && parsedPnl !== null) {
        await prisma.assetEvent.create({
          data: {
            assetId: asset.id,
            eventType: 'close',
            price: parsedExit || parsedEntry,
            volume: assetVolume,
            capitalBefore: parsedAmount,
            capitalAfter: parsedAmount + parsedPnl,
            pnlRealized: parsedPnl,
            notes: 'Posisi ditutup via Jurnal',
          }
        })
      }
    }

    // Create the Trade log
    const trade = await prisma.trade.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: symbol?.toUpperCase(),
        assetId: finalAssetId,
        entryPrice: parsedEntry,
        exitPrice: parsedExit,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        exitDate: exitDate ? new Date(exitDate) : null,
        entryAmount: parsedAmount,
        leverage: parsedLeverage,
        positionSize: parsedPositionSize,
        pnl: parsedPnl,
        pnlPercent: parsedPnlPercent,
        emotion: emotion ?? 'Neutral',
        notes: notes ?? '',
        strategy: strategy ?? '',
        status: ['close', 'cut_loss', 'liquidation', 'realize_pnl'].includes(parsedActionType) ? 'closed' : 'open',
        actionType: parsedActionType,
      },
      include: { journal: true },
    })

    // Auto-update wallet balance (tambah realized PnL jika closed)
    if (['close', 'cut_loss', 'liquidation', 'realize_pnl'].includes(parsedActionType) && parsedPnl !== null && parsedPnl !== 0) {
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

    // 2. Undo asset action if asset exists
    if (assetId) {
      const asset = await prisma.asset.findUnique({ where: { id: assetId } })
      if (asset) {
        const actionType = trade.actionType ?? 'entry'
        const entryAmount = trade.entryAmount || 0
        const pnlVal = trade.pnl || 0

        if (actionType === 'add') {
          // Revert addition: subtract from capital
          const newCapital = Math.max(0, asset.capitalUsed - entryAmount)
          await prisma.asset.update({
            where: { id: assetId },
            data: {
              capitalUsed: newCapital,
              currentCapital: Math.max(0, asset.currentCapital - entryAmount),
            }
          })
          // Delete add event
          await prisma.assetEvent.deleteMany({
            where: { assetId, eventType: 'add', capitalAfter: asset.currentCapital }
          })
        } else if (actionType === 'reduce') {
          // Revert reduction: add back to capital
          const newCapital = asset.capitalUsed + entryAmount
          await prisma.asset.update({
            where: { id: assetId },
            data: {
              capitalUsed: newCapital,
              currentCapital: asset.currentCapital + entryAmount,
            }
          })
          // Delete reduce event
          await prisma.assetEvent.deleteMany({
            where: { assetId, eventType: 'reduce', capitalAfter: asset.currentCapital }
          })
        } else if (actionType === 'realize_pnl') {
          // Revert PnL realization: subtract from realizedPnl and currentCapital
          await prisma.asset.update({
            where: { id: assetId },
            data: {
              realizedPnl: asset.realizedPnl - pnlVal,
              currentCapital: Math.max(0, asset.currentCapital - pnlVal),
            }
          })
          // Delete running event
          await prisma.assetEvent.deleteMany({
            where: { assetId, eventType: 'pnl_running', pnlRealized: pnlVal }
          })
        } else if (['close', 'cut_loss', 'liquidation'].includes(actionType)) {
          // Revert close/liquidation: reopen asset and trades
          // Check if there was any reduce event remaining to decide status
          const hasReduce = await prisma.assetEvent.findFirst({
            where: { assetId, eventType: 'reduce' }
          })
          const revertedStatus = hasReduce ? 'partial_take_profit' : 'active'

          await prisma.asset.update({
            where: { id: assetId },
            data: {
              status: revertedStatus,
              realizedPnl: asset.realizedPnl - pnlVal,
              currentCapital: asset.currentCapital - pnlVal,
            }
          })

          // Delete close event
          await prisma.assetEvent.deleteMany({
            where: { assetId, eventType: { in: ['close', 'liquidation'] } }
          })

          // Reopen all entry and add trades for this asset
          await prisma.trade.updateMany({
            where: { assetId, actionType: { in: ['entry', 'add'] } },
            data: {
              status: 'open',
              exitPrice: null,
              exitDate: null,
              pnl: null,
              pnlPercent: null,
            }
          })
        }
      }
    }

    // 3. Delete trade journal & trade
    await prisma.tradeJournal.deleteMany({ where: { tradeId: parseInt(id) } })
    await prisma.trade.delete({ where: { id: parseInt(id) } })

    // 4. Handle asset deletion if no trades left
    if (assetId) {
      const remainingTrades = await prisma.trade.findMany({ where: { assetId } })
      if (remainingTrades.length === 0) {
        await prisma.asset.delete({ where: { id: assetId } })
      }
    }

    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[DELETE /api/trades]', error)
    return NextResponse.json({ error: 'Failed to delete trade' }, { status: 500 })
  }
}
