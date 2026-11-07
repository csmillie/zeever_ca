import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js "proxy" file convention (renamed from `middleware` in Next 16.2.x;
 * https://nextjs.org/docs/messages/middleware-to-proxy). The exported `proxy()`
 * IS the edge middleware entry point — verified live: a cross-site POST to
 * /api/* returns 403, a same-origin POST passes, and the markdown rewrite fires.
 *
 * CSRF defense-in-depth: validate Origin header on /api/ mutation requests.
 *
 * This blocks cross-site POST/PUT/PATCH/DELETE to /api/ routes even if a
 * framework-level CSRF bypass is discovered (e.g. GHSA-mq59-m269-xvcx).
 *
 * - GET/HEAD pass through (safe methods)
 * - POST/PUT/PATCH/DELETE to /api/* must have an Origin header matching the Host
 * - Missing or mismatched Origin returns 403
 *
 * Markdown content negotiation:
 * - GET requests with Accept: text/markdown are rewritten to /markdown/[path]
 *   which renders the page server-side and converts to markdown.
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

function wantsMarkdown(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? ''
  return accept.includes('text/markdown')
}

export function proxy(request: NextRequest) {
  // CSRF check for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (!passesOriginCheck(request)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    return NextResponse.next()
  }

  // Markdown content negotiation: rewrite to /markdown/[path] handler
  if (
    request.method === 'GET' &&
    wantsMarkdown(request) &&
    !request.nextUrl.pathname.startsWith('/markdown/') &&
    !request.nextUrl.pathname.startsWith('/.well-known/') &&
    !request.nextUrl.pathname.startsWith('/health')
  ) {
    const path = request.nextUrl.pathname === '/' ? '/index' : request.nextUrl.pathname
    const url = request.nextUrl.clone()
    url.pathname = `/markdown${path}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|svg|ico|xml|txt|json|md)).*)',
  ],
}
