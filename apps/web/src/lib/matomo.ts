/**
 * Matomo Content Tracking utilities.
 *
 * Uses declarative data-track-content attributes where possible.
 * For dynamic DOM (answer results, citations), call rescanContent()
 * after React renders the new nodes so Matomo picks up the impressions.
 */

declare global {
  interface Window {
    _paq?: unknown[][]
  }
}

// --- Declarative attribute helpers ---

export interface TrackedContentProps {
  'data-track-content': ''
  'data-content-name': string
  'data-content-piece': string
  'data-content-target': string
  'data-content-ignoreinteraction'?: ''
}

/**
 * Returns data attributes for a Matomo tracked content block.
 * Spread these onto any HTML element to register it for impression/interaction tracking.
 */
export function trackedContent(
  name: string,
  piece: string,
  target: string,
  ignoreInteraction = false,
): TrackedContentProps {
  const attrs: TrackedContentProps = {
    'data-track-content': '',
    'data-content-name': name,
    'data-content-piece': piece,
    'data-content-target': target,
  }
  if (ignoreInteraction) {
    attrs['data-content-ignoreinteraction'] = ''
  }
  return attrs
}

// --- Imperative tracking helpers ---

/** Track a content interaction manually (e.g. form submit, accordion expand). */
export function trackContentInteraction(
  contentInteraction: string,
  contentName: string,
  contentPiece: string,
  contentTarget: string,
) {
  window._paq?.push([
    'trackContentInteraction',
    contentInteraction,
    contentName,
    contentPiece,
    contentTarget,
  ])
}

/**
 * Tell Matomo to rescan a DOM node for new tracked content blocks.
 * Call this after React renders dynamic content (answers, citations)
 * so that new data-track-content elements register as impressions.
 */
export function rescanContent(node: HTMLElement) {
  window._paq?.push(['trackContentImpressionsWithinNode', node])
}

/** Fire a custom event (category/action/name). */
export function trackEvent(category: string, action: string, name?: string) {
  window._paq?.push(['trackEvent', category, action, name])
}

/**
 * Track a query as a Matomo Site Search.
 * Shows up in Behaviour > Site Search with keyword, category, and result count.
 * Category maps to the API's query_class (e.g. "permits", "taxes").
 * Result count is the number of source citations returned.
 */
export function trackSiteSearch(
  keyword: string,
  category?: string,
  resultCount?: number,
) {
  window._paq?.push(['trackSiteSearch', keyword, category ?? false, resultCount ?? false])
}

// --- Slug helper ---

/** Convert a question or title into a stable, low-cardinality slug. */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// --- Debug mode ---

const DEBUG_KEY = 'matomo_content_debug'

export function isContentDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DEBUG_KEY) === '1'
}

/** Log a content tracking action to console when debug mode is on. */
export function debugLog(action: string, detail: Record<string, string>) {
  if (!isContentDebugEnabled()) return
  console.log(
    `%c[Matomo Content] ${action}`,
    'color: #EB7F26; font-weight: bold',
    detail,
  )
}

/**
 * Dump all data-track-content elements in the DOM to console.
 * Activate with: localStorage.setItem('matomo_content_debug', '1')
 */
export function dumpTrackedBlocks() {
  const blocks = document.querySelectorAll('[data-track-content]')
  console.group(`[Matomo Content] ${blocks.length} tracked blocks`)
  blocks.forEach((el) => {
    console.log({
      name: (el as HTMLElement).dataset.contentName,
      piece: (el as HTMLElement).dataset.contentPiece,
      target: (el as HTMLElement).dataset.contentTarget,
      ignoreInteraction: el.hasAttribute('data-content-ignoreinteraction'),
      element: el,
    })
  })
  console.groupEnd()
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).matomoDebug = {
    enable: () => { localStorage.setItem(DEBUG_KEY, '1'); console.log('Matomo content debug ON — reload page') },
    disable: () => { localStorage.removeItem(DEBUG_KEY); console.log('Matomo content debug OFF') },
    dump: dumpTrackedBlocks,
  }
}
