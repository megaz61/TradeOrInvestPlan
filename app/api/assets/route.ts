import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_USER_ID = 1

// Status yang dianggap "aktif" (modal terpakai)
const ACTIVE_STATUSES = ['active', 'partial_take_profit']
// Status yang dianggap "selesai" (modal kembali)
const CLOSED_STATUSES = ['closed_profit', 'closed_loss', 'liquidated']

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const withEvents = searchParams.get('withEvents') === 'true'

    const assets = await prisma.asset.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        ...(status && status !== 'all' && { status }),
        ...(type && type !== 'all' && { assetType: type }),
        ...(search && {
          OR: [
            { symbol: { contains: search } },
            { name: { contains: search } },
            { productName: { contains: search } },
          ],
        }),
      },
      include: {
        ...(withEvents && { events: { orderBy: { createdAt: 'asc' } } }),
        trades: { where: { status: 'open' }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: assets })
  } catch (error) {
    console.error('[GET /api/assets]', error)
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      symbol, productName, name, assetType, transactionType, platform,
      entryPrice, takeProfit, stopLoss,
      volume, leverage, capitalUsed, fee,
      entryDate, notes, chartUrl, status,
    } = body

    const parsedCapital = parseFloat(capitalUsed) || 0
    const parsedFee = parseFloat(fee) || 0
    const parsedLeverage = parseFloat(leverage) || 1
    const parsedEntry = parseFloat(entryPrice) || 0
    const newStatus = status ?? 'planned'
    const totalCapital = parsedCapital + parsedFee

    const asset = await prisma.asset.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: assetType === 'Reksadana' ? (productName ?? '') : (symbol?.toUpperCase() ?? ''),
        productName: productName ?? '',
        name: name ?? '',
        assetType: assetType ?? 'Crypto',
        transactionType: transactionType ?? 'Spot',
        platform: platform ?? '',
        entryPrice: parsedEntry,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        volume: parseFloat(volume) || 0,
        leverage: parsedLeverage,
        capitalUsed: parsedCapital,
        fee: parsedFee,
        currentCapital: parsedCapital,
        realizedPnl: 0,
        unrealizedPnl: 0,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        notes: notes ?? '',
        chartUrl: chartUrl ?? '',
        status: newStatus,
      },
    })

    const displayName = assetType === 'Reksadana'
      ? (productName || name || 'Reksadana')
      : (symbol?.toUpperCase() || name || 'Asset')

    // ── Auto-create AssetEvent (entry log) jika capital > 0
    if (parsedCapital > 0) {
      await prisma.assetEvent.create({
        data: {
          assetId: asset.id,
          eventType: 'entry',
          price: parsedEntry,
          volume: parseFloat(volume) || 0,
          capitalBefore: 0,
          capitalAfter: parsedCapital,
          pnlRealized: 0,
          notes: 'Posisi dibuka',
        },
      })
    }

    // ── Auto-create Trade (Journal) jika status ACTIVE / CLOSED dan total capital > 0
    if (totalCapital > 0) {
      if (ACTIVE_STATUSES.includes(newStatus)) {
        await prisma.trade.create({
          data: {
            userId: DEFAULT_USER_ID,
            assetId: asset.id,
            symbol: displayName,
            entryPrice: parsedEntry,
            entryDate: entryDate ? new Date(entryDate) : new Date(),
            entryAmount: totalCapital,
            leverage: parsedLeverage,
            positionSize: totalCapital * parsedLeverage,
            status: 'open',
            emotion: 'Neutral',
            notes: `[Auto] Asset dibuka: ${name || displayName}`,
            strategy: assetType ?? 'Crypto',
          },
        })
      } else if (CLOSED_STATUSES.includes(newStatus)) {
        const exitPrice = body.exitPrice ? parseFloat(body.exitPrice) : parsedEntry
        const realizedPnl = body.realizedPnl ? parseFloat(body.realizedPnl) : 0
        const pnlPercent = totalCapital > 0 ? (realizedPnl / totalCapital) * 100 : 0
        
        await prisma.trade.create({
          data: {
            userId: DEFAULT_USER_ID,
            assetId: asset.id,
            symbol: displayName,
            entryPrice: parsedEntry,
            exitPrice,
            entryDate: entryDate ? new Date(entryDate) : new Date(),
            exitDate: new Date(),
            entryAmount: totalCapital,
            leverage: parsedLeverage,
            positionSize: totalCapital * parsedLeverage,
            pnl: realizedPnl,
            pnlPercent,
            status: 'closed',
            emotion: 'Neutral',
            notes: `[Auto] Asset dibuat (Closed): ${name || displayName}`,
            strategy: assetType ?? 'Crypto',
          },
        })
      }
    }

    // ── Update wallet balance (potong fee jika non-planned, tambah realized PnL jika closed)
    const feeToDeduct = newStatus !== 'planned' ? parsedFee : 0
    let pnlToAdd = 0
    if (CLOSED_STATUSES.includes(newStatus)) {
      pnlToAdd = body.realizedPnl ? parseFloat(body.realizedPnl) : 0
    }
    const netWalletDelta = pnlToAdd - feeToDeduct

    if (netWalletDelta !== 0) {
      const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
      if (wallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            totalBalance: wallet.totalBalance + netWalletDelta,
            tradingBalance: Math.max(0, wallet.tradingBalance + netWalletDelta),
          },
        })
      }
    }

    return NextResponse.json({ data: asset }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/assets]', error)
    return NextResponse.json({ error: 'Failed to create asset' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...fields } = body

    const oldAsset = await prisma.asset.findUnique({
      where: { id: parseInt(id) },
      include: { trades: { where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: 1 } },
    })
    if (!oldAsset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

    const newStatus = fields.status ?? oldAsset.status
    const newCapital = fields.capitalUsed !== undefined ? parseFloat(fields.capitalUsed) : oldAsset.capitalUsed
    const newFee = fields.fee !== undefined ? parseFloat(fields.fee) : oldAsset.fee
    const newTotalCapital = newCapital + newFee
    
    const wasActive = ACTIVE_STATUSES.includes(oldAsset.status)
    const isNowActive = ACTIVE_STATUSES.includes(newStatus)
    const isNowClosed = CLOSED_STATUSES.includes(newStatus)
    const wasntClosed = !CLOSED_STATUSES.includes(oldAsset.status)

    // Calculate exit price and PnL if closing
    let parsedPnl = 0
    let closePrice = fields.exitPrice !== undefined && fields.exitPrice !== null ? parseFloat(fields.exitPrice) : null

    if (isNowClosed) {
      if (closePrice === null) {
        if (newStatus === 'closed_profit') {
          closePrice = oldAsset.takeProfit ?? oldAsset.entryPrice
        } else if (newStatus === 'closed_loss') {
          closePrice = oldAsset.stopLoss ?? oldAsset.entryPrice
        } else if (newStatus === 'liquidated') {
          closePrice = oldAsset.leverage > 1 ? oldAsset.entryPrice * (1 - 1 / oldAsset.leverage) : 0
        } else {
          closePrice = oldAsset.entryPrice
        }
      }
      
      const isTransition = wasntClosed
      const isParamChange = fields.capitalUsed !== undefined || fields.leverage !== undefined || fields.entryPrice !== undefined || fields.exitPrice !== undefined
      
      if (fields.realizedPnl !== undefined) {
        parsedPnl = parseFloat(fields.realizedPnl)
      } else if (isTransition || isParamChange) {
        const updatedCapital = newCapital
        const updatedLeverage = fields.leverage !== undefined ? parseFloat(fields.leverage) : oldAsset.leverage
        const updatedEntry = fields.entryPrice !== undefined ? parseFloat(fields.entryPrice) : oldAsset.entryPrice
        const updatedExit = closePrice

        if (newStatus === 'liquidated') {
          parsedPnl = -updatedCapital
        } else if (updatedEntry > 0) {
          const priceDiff = updatedExit - updatedEntry
          const pct = priceDiff / updatedEntry
          parsedPnl = updatedCapital * updatedLeverage * pct
        }
      }
    } else {
      closePrice = oldAsset.entryPrice
    }

    // Hitung realizedPnl total untuk record asset.
    let totalRealizedPnl = oldAsset.realizedPnl
    if (isNowClosed) {
      if (fields.realizedPnl !== undefined) {
        totalRealizedPnl = parseFloat(fields.realizedPnl)
      } else if (wasntClosed) {
        totalRealizedPnl = oldAsset.realizedPnl + parsedPnl
      } else if (fields.capitalUsed !== undefined || fields.leverage !== undefined || fields.entryPrice !== undefined || fields.exitPrice !== undefined) {
        totalRealizedPnl = parsedPnl
      }
    } else {
      totalRealizedPnl = 0
    }

    const walletDelta = totalRealizedPnl - oldAsset.realizedPnl
    const oldFeeDeduction = oldAsset.status !== 'planned' ? oldAsset.fee : 0
    const newFeeDeduction = newStatus !== 'planned' ? newFee : 0
    const feeDelta = newFeeDeduction - oldFeeDeduction
    const netWalletChange = walletDelta - feeDelta

    const asset = await prisma.asset.update({
      where: { id: parseInt(id) },
      data: {
        ...(fields.symbol !== undefined && {
          symbol: fields.assetType === 'Reksadana'
            ? (fields.productName ?? fields.symbol)
            : fields.symbol.toUpperCase(),
        }),
        ...(fields.productName !== undefined && { productName: fields.productName }),
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.assetType && { assetType: fields.assetType }),
        ...(fields.transactionType && { transactionType: fields.transactionType }),
        ...(fields.platform !== undefined && { platform: fields.platform }),
        ...(fields.entryPrice !== undefined && { entryPrice: parseFloat(fields.entryPrice) }),
        ...(fields.takeProfit !== undefined && { takeProfit: fields.takeProfit ? parseFloat(fields.takeProfit) : null }),
        ...(fields.stopLoss !== undefined && { stopLoss: fields.stopLoss ? parseFloat(fields.stopLoss) : null }),
        ...(fields.volume !== undefined && { volume: parseFloat(fields.volume) }),
        ...(fields.leverage !== undefined && { leverage: parseFloat(fields.leverage) }),
        ...(fields.capitalUsed !== undefined && { capitalUsed: newCapital }),
        ...(fields.fee !== undefined && { fee: newFee }),
        ...(fields.currentCapital !== undefined && { currentCapital: parseFloat(fields.currentCapital) }),
        ...(fields.unrealizedPnl !== undefined && { unrealizedPnl: parseFloat(fields.unrealizedPnl) }),
        ...(fields.entryDate && { entryDate: new Date(fields.entryDate) }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.chartUrl !== undefined && { chartUrl: fields.chartUrl }),
        ...(fields.status && { status: newStatus }),
        realizedPnl: totalRealizedPnl,
        ...(isNowClosed && { currentCapital: newCapital + totalRealizedPnl }),
      },
    })

    // ── Auto-create AssetEvent saat status berubah ke closed/liquidated
    if (isNowClosed && wasntClosed) {
      await prisma.assetEvent.create({
        data: {
          assetId: parseInt(id),
          eventType: newStatus === 'liquidated' ? 'liquidation' : 'close',
          price: closePrice,
          volume: oldAsset.volume,
          capitalBefore: oldAsset.currentCapital,
          capitalAfter: oldAsset.currentCapital + parsedPnl,
          pnlRealized: parsedPnl,
          notes: fields.notes ?? `Posisi ditutup: ${newStatus}`,
        },
      })

      // ── Auto-close Trade terkait di Journal (tutup semua trade open)
      const openTrades = await prisma.trade.findMany({
        where: { assetId: parseInt(id), status: 'open' },
        orderBy: { createdAt: 'asc' }
      })

      const totalOldCapital = oldAsset.capitalUsed + (oldAsset.fee || 0)
      const pnlPercent = totalOldCapital > 0 ? (parsedPnl / totalOldCapital) * 100 : 0

      if (openTrades.length > 0) {
        // Update first trade with PnL
        await prisma.trade.update({
          where: { id: openTrades[0].id },
          data: {
            exitPrice: closePrice,
            exitDate: new Date(),
            pnl: parsedPnl,
            pnlPercent,
            status: 'closed',
            notes: `[Auto] ${fields.notes ?? `Asset: ${newStatus}`}`,
          },
        })

        // Update other trades to closed with pnl = 0 to avoid double-counting
        if (openTrades.length > 1) {
          const otherTradeIds = openTrades.slice(1).map(t => t.id)
          await prisma.trade.updateMany({
            where: { id: { in: otherTradeIds } },
            data: {
              exitPrice: closePrice,
              exitDate: new Date(),
              pnl: 0,
              pnlPercent: 0,
              status: 'closed',
            }
          })
        }
      } else {
        const displayName = oldAsset.assetType === 'Reksadana'
          ? (oldAsset.productName || oldAsset.name)
          : oldAsset.symbol
        await prisma.trade.create({
          data: {
            userId: DEFAULT_USER_ID,
            assetId: oldAsset.id,
            symbol: displayName,
            entryPrice: oldAsset.entryPrice,
            exitPrice: closePrice,
            entryDate: oldAsset.entryDate,
            exitDate: new Date(),
            entryAmount: totalOldCapital,
            leverage: oldAsset.leverage,
            positionSize: totalOldCapital * oldAsset.leverage,
            pnl: parsedPnl,
            pnlPercent,
            status: 'closed',
            emotion: 'Neutral',
            notes: `[Auto] Asset ditutup (Direct): ${oldAsset.name || displayName}`,
            strategy: oldAsset.assetType,
          }
        })
      }
    }

    // ── Jika aset sudah closed dan diedit parameter exitPrice atau realizedPnl-nya
    const isAlreadyClosed = CLOSED_STATUSES.includes(oldAsset.status)
    if (isNowClosed && isAlreadyClosed) {
      const closedTrades = await prisma.trade.findMany({
        where: { assetId: parseInt(id), status: 'closed' },
        orderBy: { createdAt: 'asc' }
      })
      if (closedTrades.length > 0) {
        const totalOldCapital = oldAsset.capitalUsed + (oldAsset.fee || 0)
        const pnlPercent = totalOldCapital > 0 ? (parsedPnl / totalOldCapital) * 100 : 0

        // Update primary closed trade
        await prisma.trade.update({
          where: { id: closedTrades[0].id },
          data: {
            exitPrice: closePrice,
            pnl: parsedPnl,
            pnlPercent,
            symbol: fields.symbol !== undefined ? fields.symbol.toUpperCase() : undefined,
            entryPrice: fields.entryPrice !== undefined ? parseFloat(fields.entryPrice) : undefined,
            entryAmount: newTotalCapital,
            leverage: fields.leverage !== undefined ? parseFloat(fields.leverage) : undefined,
            positionSize: newTotalCapital * (fields.leverage !== undefined ? parseFloat(fields.leverage) : oldAsset.leverage),
          }
        })

        // Sync exitPrice for other trades
        if (closedTrades.length > 1) {
          const otherTradeIds = closedTrades.slice(1).map(t => t.id)
          await prisma.trade.updateMany({
            where: { id: { in: otherTradeIds } },
            data: {
              exitPrice: closePrice,
            }
          })
        }
      }
    }

    // ── Jika status berubah dari closed ke active/partial_take_profit: reopen seluruh trade
    if (isAlreadyClosed && !isNowClosed) {
      await prisma.trade.updateMany({
        where: { assetId: parseInt(id), actionType: { in: ['entry', 'add'] } },
        data: {
          status: 'open',
          exitPrice: null,
          exitDate: null,
          pnl: null,
          pnlPercent: null,
        }
      })
    }

    // ── Update wallet totalBalance & tradingBalance dengan netWalletChange
    if (netWalletChange !== 0) {
      const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
      if (wallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            totalBalance: wallet.totalBalance + netWalletChange,
            tradingBalance: Math.max(0, wallet.tradingBalance + netWalletChange),
          },
        })
      }
    }

    // ── Jika status berubah dari planned → active: buka Trade baru di journal
    const wasPlanned = oldAsset.status === 'planned'
    const totalOldCapital = oldAsset.capitalUsed + (oldAsset.fee || 0)
    if (wasPlanned && isNowActive && totalOldCapital > 0) {
      const displayName = oldAsset.assetType === 'Reksadana'
        ? (oldAsset.productName || oldAsset.name)
        : oldAsset.symbol
      await prisma.trade.create({
        data: {
          userId: DEFAULT_USER_ID,
          assetId: oldAsset.id,
          symbol: displayName,
          entryPrice: oldAsset.entryPrice,
          entryDate: oldAsset.entryDate,
          entryAmount: totalOldCapital,
          leverage: oldAsset.leverage,
          positionSize: totalOldCapital * oldAsset.leverage,
          status: 'open',
          emotion: 'Neutral',
          notes: `[Auto] Asset diaktifkan: ${oldAsset.name || displayName}`,
          strategy: oldAsset.assetType,
        },
      })
    }

    // ── Jika status berubah dari active → planned: hapus Trade open di journal
    if (wasActive && newStatus === 'planned') {
      const openTrade = oldAsset.trades[0]
      if (openTrade) {
        await prisma.trade.delete({ where: { id: openTrade.id } })
      }
    }

    // ── Jika tetap aktif tapi parameter modal / leverage / entryPrice / symbol berubah: sinkronkan ke Trade open
    if (isNowActive && !wasPlanned) {
      const openTrade = oldAsset.trades[0]
      if (openTrade) {
        const updatedCapital = fields.capitalUsed !== undefined ? parseFloat(fields.capitalUsed) : oldAsset.capitalUsed
        const updatedFee = fields.fee !== undefined ? parseFloat(fields.fee) : oldAsset.fee
        const updatedTotalCapital = updatedCapital + updatedFee
        const updatedLeverage = fields.leverage !== undefined ? parseFloat(fields.leverage) : oldAsset.leverage
        const updatedEntry = fields.entryPrice !== undefined ? parseFloat(fields.entryPrice) : oldAsset.entryPrice
        const displayName = fields.symbol !== undefined
          ? (fields.assetType === 'Reksadana' ? (fields.productName ?? fields.symbol) : fields.symbol.toUpperCase())
          : (oldAsset.assetType === 'Reksadana' ? (oldAsset.productName || oldAsset.name) : oldAsset.symbol)

        await prisma.trade.update({
          where: { id: openTrade.id },
          data: {
            symbol: displayName,
            entryAmount: updatedTotalCapital,
            leverage: updatedLeverage,
            entryPrice: updatedEntry,
            positionSize: updatedTotalCapital * updatedLeverage,
          }
        })
      }
    }

    return NextResponse.json({ data: asset })
  } catch (error) {
    console.error('[PATCH /api/assets]', error)
    return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const asset = await prisma.asset.findUnique({ where: { id: parseInt(id) } })
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Reverse wallet PnL if asset status was closed (since we added it during close/PATCH)
    // Also refund the fee if the asset was not planned (since we deducted it)
    const pnlToReverse = CLOSED_STATUSES.includes(asset.status) ? asset.realizedPnl : 0
    const feeToRefund = asset.status !== 'planned' ? (asset.fee || 0) : 0
    const walletDelta = feeToRefund - pnlToReverse

    if (walletDelta !== 0) {
      const wallet = await prisma.wallet.findFirst({ where: { userId: DEFAULT_USER_ID } })
      if (wallet) {
        await prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            totalBalance: wallet.totalBalance + walletDelta,
            tradingBalance: Math.max(0, wallet.tradingBalance + walletDelta),
          },
        })
      }
    }

    // Hapus Trade terkait
    const trades = await prisma.trade.findMany({ where: { assetId: parseInt(id) } })
    const tradeIds = trades.map(t => t.id)
    await prisma.tradeJournal.deleteMany({ where: { tradeId: { in: tradeIds } } })
    await prisma.trade.deleteMany({ where: { assetId: parseInt(id) } })

    // Hapus Aset (Event terhapus otomatis karena cascade)
    await prisma.asset.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    console.error('[DELETE /api/assets]', error)
    return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
  }
}
