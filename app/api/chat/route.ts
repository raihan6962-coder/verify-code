import { NextRequest, NextResponse } from 'next/server'
import { agent } from '@/lib/agent'

export async function GET() {
  return NextResponse.json({ ai: agent.hasAi })
}

export async function POST(req: NextRequest) {
  const { command, apiKey } = await req.json()

  if (apiKey) {
    agent.setApiKey(apiKey)
  }

  if (typeof command !== 'string') {
    return NextResponse.json({ result: 'Missing "command" in request body' }, { status: 400 })
  }

  if (!command.trim()) {
    return NextResponse.json({ result: '', ai: agent.hasAi })
  }

  const result = await agent.processMessage(command, apiKey)
  return NextResponse.json({ ...result, ai: agent.hasAi })
}
