import { NextRequest, NextResponse } from 'next/server'

/**
 * CSRF defense-in-depth: validate Origin header on all mutation requests.
 *
 * This blocks cross-site POST/PUT/PATCH/DELETE requests even if a
 * framework-level CSRF bypass is discovered (e.g. GHSA-mq59-m269-xvcx).
 *
 * - GET/HEAD pass through (safe methods)
 * - POST/PUT/PATCH/DELETE must have an Origin header matching the Host
 * - Missing or mismatched Origin returns 403
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function passesOriginCheck(request: NextRequest): boolean {
  if (SAFE_METHODS.has(request.method)) return true

  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    const originHost = new URL(origin).host
    const requestHost = request.headers.get('host') ?? request.nextUrl.host
    return originHost === requestHost
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  if (!passesOriginCheck(request)) {
    return new NextResponse('Forbidden', { status: 403 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
