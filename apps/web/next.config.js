/** @type {import('next').NextConfig} */

// Content Security Policy.
// - 'unsafe-inline' on script-src is required for Next.js hydration JSON.
// - static.cloudflareinsights.com is auto-injected by Cloudflare Web Analytics
//   (beacon.min.js) and posts back to cloudflareinsights.com.
// - frame-ancestors 'none' makes the site unframable (clickjacking defense
//   that beats X-Frame-Options because it covers all browsers).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://static.cloudflareinsights.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Content-Security-Policy', value: CSP },
]

const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/ai-compute-index',
        destination: '/canadas-ai-compute-landscape',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      // Apply baseline security headers to every route.
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
      // Hide the admin dashboard from search engines and AI crawlers, even
      // if it ever leaks publicly (auth still applies regardless).
      {
        source: '/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
      {
        source: '/api/admin/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Link',
            value: [
              '</.well-known/api-catalog>; rel="api-catalog"',
              '</llms.txt>; rel="describedby"; type="text/markdown"',
              '</feed.xml>; rel="alternate"; type="application/rss+xml"',
              '</sitemap.xml>; rel="describedby"; type="application/xml"',
            ].join(', '),
          },
        ],
      },
      {
        source: '/.well-known/agent.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/.well-known/agent-card.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/.well-known/mcp/server-card.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/llms.txt',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/llms-full.txt',
        headers: [
          { key: 'Content-Type', value: 'text/markdown; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },
};
module.exports = nextConfig;
