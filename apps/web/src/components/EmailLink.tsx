'use client'

import { useEffect, useState } from 'react'

type Props = {
  user: string
  domain: string
  className?: string
  /** Optional visible label to use after hydration. Defaults to `user@domain`. */
  label?: string
}

/**
 * Renders an email address with light bot protection. Server-side / pre-hydration
 * markup is an `<a>` with no `href` and an obfuscated text body
 * (e.g. "info [at] zeever [dot] ca"). After hydration the `href` and visible
 * address are populated client-side. Static-HTML scrapers see no clickable
 * `mailto:` and no concatenated address string.
 *
 * The element type does not change between server and client renders, so there
 * is no hydration mismatch.
 */
export default function EmailLink({ user, domain, className, label }: Props) {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])

  if (hydrated) {
    return (
      <a href={`mailto:${user}@${domain}`} className={className}>
        {label ?? `${user}@${domain}`}
      </a>
    )
  }

  return (
    <a className={className} suppressHydrationWarning>
      {user}
      <span aria-hidden="true"> [at] </span>
      {domain.replace(/\./g, ' [dot] ')}
    </a>
  )
}
