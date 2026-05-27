import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const DEFAULT_USER_ID = 1

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')

    const items = await prisma.watchlist.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        ...(search && { symbol: { contains: search } }),
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data: items })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { symbol, targetPrice, notes, currentNote } = body

    const item = await prisma.watchlist.create({
      data: {
        userId: DEFAULT_USER_ID,
        symbol: symbol?.toUpperCase(),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
        notes: notes ?? '',
        currentNote: currentNote ?? '',
      },
    })

    return NextResponse.json({ data: item }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { id, ...fields } = body

    const item = await prisma.watchlist.update({
      where: { id: parseInt(id) },
      data: {
        ...(fields.symbol && { symbol: fields.symbol.toUpperCase() }),
        ...(fields.targetPrice !== undefined && {
          targetPrice: fields.targetPrice ? parseFloat(fields.targetPrice) : null,
        }),
        ...(fields.notes !== undefined && { notes: fields.notes }),
        ...(fields.currentNote !== undefined && { currentNote: fields.currentNote }),
      },
    })

    return NextResponse.json({ data: item })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    await prisma.watchlist.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ message: 'Deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
