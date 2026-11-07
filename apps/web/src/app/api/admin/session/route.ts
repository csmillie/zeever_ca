import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3034'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24h

function clientIp(request: NextRequest): string {
  // Cloudflare sets CF-Connecting-IP after stripping any spoofed value
  // the client provided in X-Forwarded-For. Prefer it on production.
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return '127.0.0.1'
}

export async function POST(request: NextRequest) {
  let body: { password?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (!password) {
    return NextResponse.json({ error: 'missing_password' }, { status: 400 })
  }

  // Validate by hitting the read-only /stats endpoint. FastAPI applies its
  // own per-IP rate limit (LOGIN_LIMIT) so brute-force is throttled there.
  let upstreamStatus = 0
  try {
    const upstream = await fetch(`${API_URL}/api/admin/stats`, {
      headers: {
        Authorization: `Bearer ${password}`,
        'X-Real-IP': clientIp(request),
      },
    })
    upstreamStatus = upstream.status
  } catch {
    return NextResponse.json({ error: 'backend_unavailable' }, { status: 502 })
  }

  if (upstreamStatus === 429) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  if (upstreamStatus !== 200) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: COOKIE_NAME,
    value: password,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
  return res
}
