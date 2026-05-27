const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Buat user default (single-user mode)
  const user = await prisma.user.upsert({
    where: { email: 'trader@local.app' },
    update: {},
    create: {
      name: 'Trader',
      email: 'trader@local.app',
    },
  })

  // Buat wallet default
  const wallet = await prisma.wallet.upsert({
    where: { id: 1 },
    update: {},
    create: {
      userId: user.id,
      name: 'Main Wallet',
      currency: 'USD',
      totalBalance: 10000,
      tradingBalance: 2000,
    },
  })

  // Buat risk profile default
  await prisma.riskProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      maxRiskPercent: 2,
      preferredLeverage: 1,
      maxDrawdown: 20,
      currency: 'USD',
      theme: 'dark',
    },
  })

  console.log('✅ Seed berhasil! User ID:', user.id, '| Wallet ID:', wallet.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
