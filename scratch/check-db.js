const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL)
  try {
    const wallets = await prisma.wallet.findMany()
    const assets = await prisma.asset.findMany()
    const trades = await prisma.trade.findMany()
    console.log('WALLETS COUNT:', wallets.length)
    if (wallets.length > 0) {
      console.log('WALLET DETAILS:', wallets[0])
    }
    console.log('ASSETS COUNT:', assets.length)
    if (assets.length > 0) {
      console.log('ASSETS:', assets.map(a => ({ id: a.id, symbol: a.symbol, status: a.status, capitalUsed: a.capitalUsed })))
    }
    console.log('TRADES COUNT:', trades.length)
  } catch (error) {
    console.error('Database connection error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
