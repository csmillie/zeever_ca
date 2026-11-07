import type { Metadata } from 'next'

// The admin dashboard answers 200 to anyone who asks. The page itself is useless
// without a session, but the URL is still indexable, and `Disallow: /admin/` in
// robots.txt does not match the bare `/admin` path. robots.txt now covers the
// prefix, and this is the second layer: a disallow only stops a crawler that
// reads it, while noindex travels with the response to anything that fetches the
// page anyway, including from a link we do not control.
export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {children}
    </div>
  )
}
