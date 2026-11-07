import { NextRequest, NextResponse } from 'next/server'

const PORT = process.env.PORT || '3033'

/**
 * Convert HTML to markdown. Pure string transforms for edge/node runtime.
 */
function htmlToMarkdown(html: string): string {
  let content = html
  const mainMatch = content.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  if (mainMatch) {
    content = mainMatch[1]
  } else {
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyMatch) content = bodyMatch[1]
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const pageTitle = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, '') : ''

  let md = content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<\/?[uo]l[^>]*>/gi, '\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n---\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&copy;/g, '(c)')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (pageTitle) {
    md = `# ${pageTitle}\n\n${md}`
  }

  return md
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const pagePath = path[0] === 'index' ? '/' : `/${path.join('/')}`

  // Fetch from localhost (bypasses Apache/SSL, hits Next.js directly)
  const res = await fetch(`http://127.0.0.1:${PORT}${pagePath}`, {
    headers: { 'Accept': 'text/html' },
  })

  if (!res.ok) {
    return new NextResponse('Page not found', { status: 404 })
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    return new NextResponse('Not an HTML page', { status: 400 })
  }

  const html = await res.text()
  const markdown = htmlToMarkdown(html)
  const tokenCount = Math.ceil(markdown.length / 4)

  return new NextResponse(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'x-markdown-tokens': String(tokenCount),
    },
  })
}
