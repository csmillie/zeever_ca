'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

const LINKS: { href: string; label: string; key: string }[] = [
  { href: '/', label: 'Ask', key: 'ask' },
  { href: '/about', label: 'About', key: 'about' },
  { href: '/faq', label: 'FAQ', key: 'faq' },
  { href: '/canadas-ai-compute-landscape', label: "Canada's AI Compute Landscape", key: 'ai_compute_landscape' },
  { href: '/research/canadian-data-centres', label: 'Data Centres', key: 'data_centres' },
  { href: '/research', label: 'Research', key: 'research' },
]

export default function SiteNav() {
  const [open, setOpen] = useState(false)

  const closeMenu = useCallback(() => setOpen(false), [])
  const toggleMenu = useCallback(() => setOpen(o => !o), [])

  // Close drawer on Escape; clean up listener when closed.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <nav aria-label="Primary" className="border-b border-zeever-accent/20 bg-white relative z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary"
          onClick={closeMenu}
          aria-label="Zeever.ca — home"
        >
          <div className="w-8 h-8 rounded-lg bg-zeever-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">Z</span>
          </div>
          <span className="text-xl font-semibold text-zeever-text">zeever.ca</span>
        </Link>

        {/* Desktop: inline links from md (768px) up */}
        <div className="hidden md:flex items-center gap-3 lg:gap-6">
          {LINKS.map(l => (
            <Link
              key={l.key}
              href={l.href}
              className="text-sm text-gray-700 hover:text-zeever-text rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary transition-colors whitespace-nowrap"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Mobile: hamburger button below md */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-gray-700 hover:text-zeever-text hover:bg-zeever-accent/10 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="site-mobile-nav"
          onClick={toggleMenu}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {open ? (
              <>
                <line x1="5" y1="5" x2="17" y2="17" />
                <line x1="17" y1="5" x2="5" y2="17" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="19" y2="6" />
                <line x1="3" y1="11" x2="19" y2="11" />
                <line x1="3" y1="16" x2="19" y2="16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        id="site-mobile-nav"
        className={`md:hidden border-t border-zeever-accent/20 bg-white shadow-md overflow-hidden transition-[max-height] duration-200 ease-out ${
          open ? 'max-h-96' : 'max-h-0 border-t-0'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 py-1 flex flex-col">
          {LINKS.map(l => (
            <Link
              key={l.key}
              href={l.href}
              className="block py-3 text-base text-gray-700 hover:text-zeever-text border-b border-zeever-accent/10 last:border-b-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary rounded-sm"
              onClick={closeMenu}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
