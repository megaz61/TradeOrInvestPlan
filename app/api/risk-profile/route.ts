import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_USER_ID = 1

export async function GET() {
  try {
    const profile = await prisma.riskProfile.findUnique({
      where: { userId: DEFAULT_USER_ID },
    })
    return NextResponse.json({ data: profile })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()

    const profile = await prisma.riskProfile.upsert({
      where: { userId: DEFAULT_USER_ID },
      update: {
        ...(body.maxRiskPercent !== undefined && { maxRiskPercent: parseFloat(body.maxRiskPercent) }),
        ...(body.preferredLeverage !== undefined && { preferredLeverage: parseFloat(body.preferredLeverage) }),
        ...(body.maxDrawdown !== undefined && { maxDrawdown: parseFloat(body.maxDrawdown) }),
        ...(body.currency && { currency: body.currency }),
        ...(body.theme && { theme: body.theme }),
      },
      create: {
        userId: DEFAULT_USER_ID,
        maxRiskPercent: body.maxRiskPercent ?? 2,
        preferredLeverage: body.preferredLeverage ?? 1,
        maxDrawdown: body.maxDrawdown ?? 20,
        currency: body.currency ?? 'USD',
        theme: body.theme ?? 'dark',
      },
    })

    return NextResponse.json({ data: profile })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
