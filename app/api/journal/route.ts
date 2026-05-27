import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_USER_ID = 1

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const tradeId = searchParams.get('tradeId')

    if (tradeId) {
      const journal = await prisma.tradeJournal.findUnique({
        where: { tradeId: parseInt(tradeId) },
      })
      return NextResponse.json({ data: journal })
    }

    const journals = await prisma.tradeJournal.findMany({
      include: { trade: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: journals })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { tradeId, emotion, mistakes, analysis } = body

    const journal = await prisma.tradeJournal.upsert({
      where: { tradeId: parseInt(tradeId) },
      update: {
        emotion: emotion ?? 'Neutral',
        mistakes: mistakes ?? '',
        analysis: analysis ?? '',
      },
      create: {
        tradeId: parseInt(tradeId),
        emotion: emotion ?? 'Neutral',
        mistakes: mistakes ?? '',
        analysis: analysis ?? '',
      },
    })

    return NextResponse.json({ data: journal }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
