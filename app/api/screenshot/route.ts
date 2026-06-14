import { NextResponse } from 'next/server'
import { agent } from '@/lib/agent'

const noCache = { 'Cache-Control': 'no-store, no-cache, must-revalidate' }

export async function GET() {
  const buf = await agent.getScreenshot()
  if (!buf) {
    return new NextResponse(null, { status: 204, headers: noCache })
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: { 'Content-Type': 'image/jpeg', ...noCache },
  })
}
