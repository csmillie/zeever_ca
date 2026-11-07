'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const API_URL = '/api/admin'
const SESSION_URL = '/api/admin/session'

interface Stats {
  urls_discovered: number
  raw_with_content: number
  awaiting_parse: number
  unparsed_html: number
  uncrawled_pdfs: number
  parsed_documents: number
  parsed_pdfs: number
  chunks: number
  embedded: number
  unembedded: number
  empty_chunks: number
  graph_nodes: number
  graph_edges: number
  // What the retriever actually searches. Under Turbopuffer a chunk is
  // retrievable only if it also reached the index, so `embedded` alone can
  // report a healthy corpus while search is missing thousands of chunks.
  retrieval_backend: string
  indexed: number | null
  index_error: string | null
}

interface CrawlRun {
  id: string
  started_at: string | null
  completed_at: string | null
  status: string
  pages_found: number
  pages_crawled: number
  pdfs_downloaded: number
  error: string | null
}

interface ContentType {
  type: string
  count: number
  total_words: number
}

interface Section {
  section: string
  count: number
}

interface EmbeddingRow {
  content_type: string
  total_chunks: number
  embedded: number
  unembedded: number
}

// All admin requests rely on the HttpOnly `admin_session` cookie set by
// /api/admin/session. The browser never sees the password after login.
// `credentials: 'same-origin'` is the default for same-origin fetches but
// is set explicitly so the cookie behavior stays obvious to readers.
async function fetchAdmin(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'same-origin',
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

async function postAdmin(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 401) throw new Error('unauthorized')
  return res.json()
}

async function logout() {
  await fetch(SESSION_URL, { method: 'DELETE', credentials: 'same-origin' })
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(SESSION_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.status === 429) {
        setError('Too many attempts. Wait a minute and try again.')
        return
      }
      if (!res.ok) {
        setError('Invalid password')
        return
      }
      setPassword('')
      onLogin()
    } catch {
      setError('Could not reach the server')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-semibold text-zeever-text mb-6">Admin</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'admin-password-error' : undefined}
            className="w-full rounded-lg border border-zeever-accent/30 px-4 py-2.5 text-base sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-zeever-primary/30 focus:border-zeever-primary"
            autoFocus
            required
          />
        </div>
        {error && (
          <p id="admin-password-error" role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || !password}
          className="w-full rounded-lg bg-zeever-primary-text px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-xl border border-zeever-accent/20 p-4">
      <p className="text-2xl font-bold text-zeever-primary">{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

interface PipelineStatus {
  running: boolean
  step?: string
  started_at?: string
  completed_at?: string
  error?: string | null
  progress?: {
    pages_found?: number
    pages_crawled?: number
    pdfs_downloaded?: number
    new_documents?: number
    documents_parsed?: number
    chunks_embedded?: number
  }
  before?: Record<string, number>
  after?: Record<string, number>
}

const STEP_LABELS: Record<string, string> = {
  starting: 'Starting...',
  crawling: 'Crawling Toronto.ca...',
  crawl_complete: 'Crawl complete',
  parsing: 'Parsing documents...',
  parse_complete: 'Parsing complete',
  embedding: 'Embedding chunks...',
  cleanup: 'Cleaning up raw content...',
  complete: 'Complete',
  failed: 'Failed',
}

const STEP_ORDER = ['crawling', 'parsing', 'embedding', 'complete']
const STEP_COMPLETE: Record<string, string> = {
  crawling: 'crawl_complete',
  parsing: 'parse_complete',
  embedding: 'complete',
}
const STEP_DISPLAY: Record<string, string> = {
  crawling: 'Crawl',
  parsing: 'Parse',
  embedding: 'Embed',
  complete: 'Done',
}

function StepIndicator({ currentStep }: { currentStep: string }) {
  const currentIndex = STEP_ORDER.findIndex(s => currentStep.startsWith(s) || currentStep === STEP_COMPLETE[s])

  return (
    <div className="flex items-center gap-1 mb-4">
      {STEP_ORDER.map((step, i) => {
        const label = STEP_DISPLAY[step] || step
        const isActive = currentStep.startsWith(step) || currentStep === STEP_COMPLETE[step]
        const isDone = i < currentIndex || currentStep === 'complete'
        const isCurrent = isActive && !isDone

        return (
          <div key={step} className="flex items-center gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isDone ? 'bg-green-100 text-green-700' :
              isCurrent ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-400'
            }`}>
              {isDone && <span>&#10003;</span>}
              {isCurrent && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              {label}
            </div>
            {i < STEP_ORDER.length - 1 && <span className="text-gray-300 text-xs">&#8250;</span>}
          </div>
        )
      })}
    </div>
  )
}

function PipelinePanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [status, setStatus] = useState<PipelineStatus>({ running: false })
  const [pipelineMessage, setPipelineMessage] = useState('')
  // Track running state in a ref so the polling interval doesn't tear down
  // and rebuild every time `status.running` changes.
  const runningRef = useRef(false)
  runningRef.current = status.running

  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    async function tick() {
      try {
        const data = await fetchAdmin('/pipeline/status')
        if (!cancelled) setStatus(data)
      } catch (err) {
        if (err instanceof Error && err.message === 'unauthorized') {
          onUnauthorized()
          return
        }
      }
      if (!cancelled) {
        timeout = setTimeout(tick, runningRef.current ? 5000 : 15000)
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [onUnauthorized])

  async function startPipeline(skipCrawl: boolean) {
    setPipelineMessage('')
    try {
      const data = await postAdmin('/pipeline/start', { skip_crawl: skipCrawl })
      if (data.status === 'already_running') {
        setStatus(prev => ({ ...prev, running: true }))
        setPipelineMessage('Pipeline is already running.')
      } else if (data.status === 'started') {
        setStatus(prev => ({ ...prev, running: true, step: 'starting' }))
        setPipelineMessage(`Pipeline started${skipCrawl ? ' (skip crawl)' : ''}.`)
      } else {
        setPipelineMessage(data.detail || 'Failed to start pipeline.')
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        onUnauthorized()
        return
      }
      setPipelineMessage('Could not reach the server.')
    }
  }

  function formatDuration(startedAt?: string): string {
    if (!startedAt) return ''
    const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remaining = seconds % 60
    return `${minutes}m ${remaining}s`
  }

  const p = status.progress || {}

  return (
    <div>
      <h2 className="text-lg font-semibold text-zeever-text mb-3">Data Pipeline</h2>
      <div className="bg-white rounded-xl border border-zeever-accent/20 p-5">

        {/* Step indicators when running */}
        {status.running && status.step && status.step !== 'starting' && (
          <StepIndicator currentStep={status.step} />
        )}

        {/* Status line */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className={`w-2.5 h-2.5 rounded-full ${
              status.running ? 'bg-blue-500 animate-pulse' :
              status.step === 'failed' ? 'bg-red-500' :
              status.step === 'complete' ? 'bg-green-500' :
              'bg-gray-300'
            }`} />
            <span className="text-sm text-gray-700">
              {status.running
                ? STEP_LABELS[status.step || 'starting'] || status.step
                : status.step === 'failed'
                  ? 'Pipeline failed'
                  : status.step === 'complete'
                    ? 'Pipeline complete'
                    : 'Pipeline idle'
              }
            </span>
          </div>
          {status.running && status.started_at && (
            <span className="text-xs text-gray-400">{formatDuration(status.started_at)}</span>
          )}
        </div>

        {/* Crawl progress */}
        {status.running && status.step === 'crawling' && (p.pages_found || p.pages_crawled) ? (
          <div className="mb-4">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-zeever-primary">{(p.pages_crawled || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Pages crawled</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-zeever-primary">{(p.pdfs_downloaded || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500">PDFs downloaded</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50">
                <p className="text-lg font-bold text-zeever-primary">{(p.pages_found || 0).toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total URLs found</p>
              </div>
            </div>
            {p.pages_found ? (
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-zeever-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.round(((p.pages_crawled || 0) / p.pages_found) * 100))}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Parse/embed progress */}
        {status.running && (status.step?.includes('pars') || status.step?.includes('embed')) && (p.documents_parsed || p.chunks_embedded) ? (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="text-center p-2 rounded-lg bg-gray-50">
              <p className="text-lg font-bold text-zeever-primary">{(p.new_documents || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">New docs</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-gray-50">
              <p className="text-lg font-bold text-zeever-primary">{(p.documents_parsed || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Parsed</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-gray-50">
              <p className="text-lg font-bold text-zeever-primary">{(p.chunks_embedded || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500">Embedded</p>
            </div>
          </div>
        ) : null}

        {/* Last run summary */}
        {!status.running && status.step === 'complete' && status.before && status.after && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-sm text-green-800">
            Last run: +{(status.after.raw_documents || 0) - (status.before.raw_documents || 0)} docs,
            +{(status.after.embedded || 0) - (status.before.embedded || 0)} embeddings.
            {status.completed_at && ` Finished ${new Date(status.completed_at).toLocaleString()}`}
          </div>
        )}

        {/* Error message */}
        {status.step === 'failed' && status.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
            Error: {status.error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => startPipeline(false)}
            disabled={status.running}
            className="rounded-lg bg-zeever-primary-text px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Run Full Pipeline
          </button>
          <button
            onClick={() => startPipeline(true)}
            disabled={status.running}
            className="rounded-lg border border-zeever-accent/30 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Parse + Embed Only
          </button>
        </div>
        {pipelineMessage && (
          <p className="text-sm text-gray-500 mt-3">{pipelineMessage}</p>
        )}
        <p className="text-xs text-gray-400 mt-3">
          Full pipeline: crawl Toronto.ca, parse new pages, embed chunks. Polls every {status.running ? '5' : '15'} seconds.
        </p>
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  guides: 'Guides & Handbooks',
  forms: 'Forms & Applications',
  policies: 'Policies & Procedures',
  building: 'Building & Permits',
  bylaws: 'Bylaws',
  plans: 'Plans & Strategies',
  reports: 'Reports',
  consultations: 'Consultations',
  budget: 'Budget',
  legal: 'Legal Documents',
  agendas: 'Agendas & Minutes',
  maps: 'Maps',
  other: 'Other',
}

interface PdfCategory {
  category: string
  count: number
}

function PdfDownloadPanel({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [categories, setCategories] = useState<PdfCategory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await fetchAdmin('/pdf-categories')
        if (!cancelled) setCategories(data.categories)
      } catch (err) {
        if (err instanceof Error && err.message === 'unauthorized') {
          onUnauthorized()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [onUnauthorized])

  function toggleCategory(cat: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const selectedCount = categories
    .filter(c => selected.has(c.category))
    .reduce((sum, c) => sum + c.count, 0)

  async function startDownload() {
    setMessage('')
    try {
      const data = await postAdmin('/pipeline/start', {
        action: 'download-pdfs',
        categories: Array.from(selected),
      })
      if (data.status === 'already_running') {
        setMessage('Pipeline is already running.')
      } else if (data.status === 'started') {
        setMessage(`Downloading ${selectedCount.toLocaleString()} PDFs...`)
      } else {
        setMessage(data.detail || 'Failed to start download.')
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'unauthorized') {
        onUnauthorized()
        return
      }
      setMessage('Could not reach the server.')
    }
  }

  if (loading) return null

  const total = categories.reduce((sum, c) => sum + c.count, 0)
  if (total === 0) return null

  return (
    <div>
      <h2 className="text-lg font-semibold text-zeever-text mb-3">PDF Downloads</h2>
      <div className="bg-white rounded-xl border border-zeever-accent/20 p-5">
        <p className="text-sm text-gray-500 mb-4">
          {total.toLocaleString()} uncrawled PDFs found. Select categories to download, parse, and embed.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {categories.map(c => (
            <label
              key={c.category}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-colors ${
                selected.has(c.category)
                  ? 'border-zeever-primary bg-zeever-primary/5 text-zeever-text'
                  : 'border-zeever-accent/20 text-gray-500 hover:border-zeever-accent/40'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(c.category)}
                onChange={() => toggleCategory(c.category)}
                className="rounded-sm border-gray-300 text-zeever-primary focus:ring-zeever-primary/30"
              />
              <span className="flex-1">{CATEGORY_LABELS[c.category] || c.category}</span>
              <span className="font-mono text-xs text-gray-400">{c.count.toLocaleString()}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={startDownload}
            disabled={selected.size === 0}
            className="rounded-lg bg-zeever-primary-text px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Download {selectedCount > 0 ? `${selectedCount.toLocaleString()} PDFs` : ''}
          </button>
          {selectedCount > 0 && (
            <span className="text-xs text-gray-400">
              ~{Math.round(selectedCount * 0.5)} MB estimated
            </span>
          )}
        </div>
        {message && <p className="text-sm text-gray-500 mt-3">{message}</p>}
      </div>
    </div>
  )
}

function Dashboard({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([])
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [embeddings, setEmbeddings] = useState<EmbeddingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, c, b, e] = await Promise.all([
          fetchAdmin('/stats'),
          fetchAdmin('/crawl-runs'),
          fetchAdmin('/content-breakdown'),
          fetchAdmin('/embedding-status'),
        ])
        if (cancelled) return
        setStats(s)
        setCrawlRuns(c.runs)
        setContentTypes(b.content_types)
        setSections(b.sections)
        setEmbeddings(e.breakdown)
        setLoadError(null)
      } catch (err) {
        if (cancelled) return
        if (err instanceof Error && err.message === 'unauthorized') {
          onUnauthorized()
          return
        }
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [onUnauthorized])

  async function handleSignOut() {
    await logout()
    onUnauthorized()
  }

  // Turbopuffer reports an approximate row count, so a handful either way is the
  // estimate rather than a real gap. Null means there is nothing to compare:
  // pgvector is serving, or the index could not be reached.
  const INDEX_COUNT_TOLERANCE = 50
  const indexDrift =
    stats && stats.indexed !== null &&
    Math.abs(stats.embedded - stats.indexed) > INDEX_COUNT_TOLERANCE
      ? stats.embedded - stats.indexed
      : null

  if (loading) return <p className="text-gray-600 mt-20 text-center" role="status">Loading…</p>
  if (loadError) {
    return (
      <div role="alert" className="max-w-md mx-auto mt-20 p-4 rounded-lg bg-red-50 border border-red-200">
        <p className="text-sm font-medium text-red-700 mb-2">Could not load dashboard</p>
        <p className="text-sm text-red-600">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zeever-text">Admin Dashboard</h1>
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-600 hover:text-zeever-text focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-zeever-primary rounded-sm transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Content pipeline */}
      {stats && (
        <div>
          <h2 className="text-lg font-semibold text-zeever-text mb-3">Content Pipeline</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <StatCard label="URLs discovered" value={stats.urls_discovered} />
            <StatCard label="Parsed & indexed" value={stats.parsed_documents} />
            <StatCard
              label="Searchable chunks"
              value={stats.indexed ?? stats.embedded}
            />
            <StatCard label="Parsed PDFs" value={stats.parsed_pdfs} />
          </div>

          {/* Actionable gaps */}
          {(stats.awaiting_parse > 0 || stats.unparsed_html > 0 || stats.unembedded > 0 ||
            indexDrift !== null || stats.index_error) && (
            <div className="bg-white rounded-xl border border-orange-200 p-4 space-y-2 mb-4">
              <p className="text-sm font-medium text-orange-700">Action needed</p>
              {stats.awaiting_parse > 0 && (
                <p className="text-sm text-gray-600">
                  <span className="font-mono font-medium text-orange-600">{stats.awaiting_parse.toLocaleString()}</span> documents awaiting parse
                </p>
              )}
              {stats.unparsed_html > 0 && (
                <p className="text-sm text-gray-600">
                  <span className="font-mono font-medium text-orange-600">{stats.unparsed_html.toLocaleString()}</span> HTML pages need crawling
                </p>
              )}
              {stats.unembedded > 0 && (
                <p className="text-sm text-gray-600">
                  <span className="font-mono font-medium text-orange-600">{stats.unembedded.toLocaleString()}</span> chunks awaiting embedding
                </p>
              )}
              {indexDrift !== null && indexDrift > 0 && (
                <p className="text-sm text-gray-600">
                  <span className="font-mono font-medium text-orange-600">{indexDrift.toLocaleString()}</span> embedded chunks missing from the search index (not retrievable)
                </p>
              )}
              {indexDrift !== null && indexDrift < 0 && (
                <p className="text-sm text-gray-600">
                  <span className="font-mono font-medium text-orange-600">{Math.abs(indexDrift).toLocaleString()}</span> index rows for chunks no longer in the corpus (can still be cited)
                </p>
              )}
              {stats.index_error && (
                <p className="text-sm text-gray-600">
                  Could not reach the search index to check it (<span className="font-mono">{stats.index_error}</span>)
                </p>
              )}
            </div>
          )}

          {/* Non-actionable info */}
          <div className="bg-white rounded-xl border border-zeever-accent/20 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Coverage info</p>
            {stats.awaiting_parse === 0 && stats.unparsed_html === 0 && stats.unembedded === 0 &&
              indexDrift === null && !stats.index_error && (
              <p className="text-sm text-green-600">All content is parsed, embedded and indexed. No action needed.</p>
            )}
            <p className="text-sm text-gray-500">
              Retrieval backend <span className="font-mono text-gray-400">{stats.retrieval_backend}</span>
              {stats.indexed !== null && (
                <>, <span className="font-mono text-gray-400">{stats.indexed.toLocaleString()}</span> rows indexed against <span className="font-mono text-gray-400">{stats.embedded.toLocaleString()}</span> embedded</>
              )}
            </p>
            <p className="text-sm text-gray-500">
              <span className="font-mono text-gray-400">{stats.uncrawled_pdfs.toLocaleString()}</span> PDF link references (discovered but not downloaded, expected)
            </p>
            {stats.empty_chunks > 0 && (
              <p className="text-sm text-gray-500">
                <span className="font-mono text-gray-400">{stats.empty_chunks.toLocaleString()}</span> empty chunks (scanned PDFs with no extractable text)
              </p>
            )}
            {/* A permanent 0/0 reads as a broken feature. The graph is real and
                optional: scripts/build_graph.py populates it and /api/query
                ?mode=graph uses it, but it has never been built here. Say that
                instead of showing two zeros. */}
            {stats.graph_nodes === 0 && stats.graph_edges === 0 ? (
              <p className="text-sm text-gray-500">
                Knowledge graph not built (optional; <span className="font-mono text-gray-400">scripts/build_graph.py</span>)
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                <span className="font-mono text-gray-400">{stats.graph_nodes.toLocaleString()}</span> graph nodes, <span className="font-mono text-gray-400">{stats.graph_edges.toLocaleString()}</span> graph edges
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pipeline controls */}
      <PipelinePanel onUnauthorized={onUnauthorized} />

      {/* PDF Download */}
      <PdfDownloadPanel onUnauthorized={onUnauthorized} />

      {/* Content by section */}
      <div>
        <h2 className="text-lg font-semibold text-zeever-text mb-3">Content by Section</h2>
        <div className="bg-white rounded-xl border border-zeever-accent/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zeever-accent/10">
                <th className="text-left px-4 py-2 font-medium text-gray-700">Section</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Documents</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s, i) => (
                <tr key={i} className="border-t border-zeever-accent/10">
                  <td className="px-4 py-2">{s.section}</td>
                  <td className="px-4 py-2 text-right font-mono">{s.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content by type */}
      <div>
        <h2 className="text-lg font-semibold text-zeever-text mb-3">Content by Type</h2>
        <div className="bg-white rounded-xl border border-zeever-accent/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zeever-accent/10">
                <th className="text-left px-4 py-2 font-medium text-gray-700">Type</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Documents</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Total Words</th>
              </tr>
            </thead>
            <tbody>
              {contentTypes.map((ct, i) => (
                <tr key={i} className="border-t border-zeever-accent/10">
                  <td className="px-4 py-2">{ct.type}</td>
                  <td className="px-4 py-2 text-right font-mono">{ct.count.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{ct.total_words.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embedding status */}
      <div>
        <h2 className="text-lg font-semibold text-zeever-text mb-3">Embedding Status</h2>
        <div className="bg-white rounded-xl border border-zeever-accent/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zeever-accent/10">
                <th className="text-left px-4 py-2 font-medium text-gray-700">Content Type</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Chunks</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Embedded</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Unembedded</th>
              </tr>
            </thead>
            <tbody>
              {embeddings.map((e, i) => (
                <tr key={i} className="border-t border-zeever-accent/10">
                  <td className="px-4 py-2">{e.content_type}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.total_chunks.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.embedded.toLocaleString()}</td>
                  <td className={`px-4 py-2 text-right font-mono ${e.unembedded > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {e.unembedded.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Crawl history */}
      <div>
        <h2 className="text-lg font-semibold text-zeever-text mb-3">Crawl History</h2>
        <div className="bg-white rounded-xl border border-zeever-accent/20 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zeever-accent/10">
                <th className="text-left px-4 py-2 font-medium text-gray-700">Started</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Found</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Crawled</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">PDFs</th>
              </tr>
            </thead>
            <tbody>
              {crawlRuns.map((run, i) => (
                <tr key={i} className="border-t border-zeever-accent/10">
                  <td className="px-4 py-2 text-xs">
                    {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      run.status === 'completed' ? 'bg-green-100 text-green-700' :
                      run.status === 'running' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{run.pages_found}</td>
                  <td className="px-4 py-2 text-right font-mono">{run.pages_crawled}</td>
                  <td className="px-4 py-2 text-right font-mono">{run.pdfs_downloaded}</td>
                </tr>
              ))}
              {crawlRuns.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-center text-gray-400">No crawl runs yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
  // The HttpOnly session cookie is invisible to JS, so we cannot detect
  // an existing session from the client. Probing /api/admin/stats on mount
  // would burn a login-rate-limited request on every page load. Instead,
  // assume signed-out and let the user re-enter the password (cheap UX
  // cost, big security win — the cookie itself remains the source of truth
  // and the proxy enforces it).
  const [authenticated, setAuthenticated] = useState(false)
  const handleUnauthorized = useCallback(() => setAuthenticated(false), [])

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />
  }

  return <Dashboard onUnauthorized={handleUnauthorized} />
}
