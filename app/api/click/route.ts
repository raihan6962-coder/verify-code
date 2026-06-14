import { NextRequest, NextResponse } from 'next/server'
import { agent } from '@/lib/agent'

export async function POST(req: NextRequest) {
  const { x, y } = await req.json()
  if (typeof x !== 'number' || typeof y !== 'number') {
    return NextResponse.json({ result: 'Missing x/y coordinates' }, { status: 400 })
  }
  const result = await agent.clickAt(x, y)
  return NextResponse.json(result)
}
