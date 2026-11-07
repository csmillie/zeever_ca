import { NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3034'

export async function GET() {
  try {
    const res = await fetch(`${API_URL}/health`, { next: { revalidate: 0 } })
    if (!res.ok) {
      return NextResponse.json({ status: 'degraded', backend: false }, { status: 503 })
    }
    const data = await res.json()
    return NextResponse.json({ status: 'ok', backend: true, ...data })
  } catch {
    return NextResponse.json({ status: 'degraded', backend: false }, { status: 503 })
  }
}
