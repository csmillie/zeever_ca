import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL || 'http://localhost:3034'

const COOKIE_NAME = 'admin_session'

// Explicit allowlist of admin endpoints exposed through the Next.js proxy.
// Anything not in this set returns 404 before forwarding, even if the
// FastAPI backend gains a new route. New endpoints must be added here
// before they become reachable from the browser.
const ALLOWED_PATHS = new Set([
  'stats',
  'crawl-runs',
  'content-breakdown',
  'embedding-status',
  'gaps',
  'pdf-categories',
  'pipeline/status',
  'pipeline/start',
])

function clientIp(request: NextRequest): string {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return '127.0.0.1'
}

async function proxyRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const subPath = path.join('/')

  if (!ALLOWED_PATHS.has(subPath)) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  const session = request.cookies.get(COOKIE_NAME)?.value
  if (!session) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session}`,
    'X-Real-IP': clientIp(request),
  }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  }

  if (request.method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    fetchOptions.body = await request.text()
  }

  try {
    const response = await fetch(`${API_URL}/api/admin/${subPath}`, fetchOptions)
    const text = await response.text()
    // Forward upstream status + body verbatim. JSON-parse defensively so a
    // backend error page (HTML 502) doesn't break the response.
    let data: unknown
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { detail: text }
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ detail: 'Backend unavailable' }, { status: 502 })
  }
}

export const GET = proxyRequest
export const POST = proxyRequest
