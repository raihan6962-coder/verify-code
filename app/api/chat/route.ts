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

  if (!command || typeof command !== 'string') {
    return NextResponse.json({ result: 'Missing "command" in request body' }, { status: 400 })
  }

  const result = await agent.processMessage(command)
  return NextResponse.json({ ...result, ai: agent.hasAi })
}
