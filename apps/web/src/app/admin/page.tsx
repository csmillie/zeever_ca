'use client'

import { useState, useEffect } from 'react'

const API_URL = '/api/admin'

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

function getToken(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(/admin_token=([^;]+)/)
  return match ? match[1] : ''
}

function setToken(token: string) {
  document.cookie = `admin_token=${token}; path=/admin; max-age=86400; SameSite=Strict`
}

function clearToken() {
  document.cookie = 'admin_token=; path=/admin; max-age=0'
}

async function fetchAdmin(path: string, token: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) throw new Error('unauthorized')
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

function LoginForm({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await fetchAdmin('/stats', password)
      setToken(password)
      onLogin(password)
    } catch {
      setError('Invalid password')
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-20">
      <h1 className="text-2xl font-semibold text-zeever-text mb-6">Admin</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-zeever-accent/30 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-zeever-primary/30"
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          className="w-full rounded-lg bg-[#C46A1D] px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 transition-all"
        >
          Sign in
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

function PipelinePanel({ token }: { token: string }) {
  const [status, setStatus] = useState<PipelineStatus>({ running: false })
  const [pipelineMessage, setPipelineMessage] = useState('')

  useEffect(() => {
    async function checkStatus() {
      try {
        const data = await fetchAdmin('/pipeline/status', token)
        setStatus(data)
      } catch {}
    }
    checkStatus()
    const interval = setInterval(checkStatus, status.running ? 5000 : 15000)
    return () => clearInterval(interval)
  }, [token, status.running])

  async function startPipeline(skipCrawl: boolean) {
    setPipelineMessage('')
    try {
      const res = await fetch(`${API_URL}/pipeline/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ skip_crawl: skipCrawl }),
      })
      const data = await res.json()
      if (data.status === 'already_running') {
        setStatus(prev => ({ ...prev, running: true }))
        setPipelineMessage('Pipeline is already running.')
      } else if (data.status === 'started') {
        setStatus(prev => ({ ...prev, running: true, step: 'starting' }))
        setPipelineMessage(`Pipeline started${skipCrawl ? ' (skip crawl)' : ''}.`)
      } else {
        setPipelineMessage(data.detail || 'Failed to start pipeline.')
      }
    } catch {
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
            className="rounded-lg bg-[#C46A1D] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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

function PdfDownloadPanel({ token }: { token: string }) {
  const [categories, setCategories] = useState<PdfCategory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAdmin('/pdf-categories', token)
        setCategories(data.categories)
      } catch {}
      setLoading(false)
    }
    load()
  }, [token])

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
      const res = await fetch(`${API_URL}/pipeline/start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'download-pdfs',
          categories: Array.from(selected),
        }),
      })
      const data = await res.json()
      if (data.status === 'already_running') {
        setMessage('Pipeline is already running.')
      } else if (data.status === 'started') {
        setMessage(`Downloading ${selectedCount.toLocaleString()} PDFs...`)
      } else {
        setMessage(data.detail || 'Failed to start download.')
      }
    } catch {
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
                className="rounded border-gray-300 text-zeever-primary focus:ring-zeever-primary/30"
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
            className="rounded-lg bg-[#C46A1D] px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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

function Dashboard({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [crawlRuns, setCrawlRuns] = useState<CrawlRun[]>([])
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [sections, setSections] = useState<Section[]>([])
  const [embeddings, setEmbeddings] = useState<EmbeddingRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [s, c, b, e] = await Promise.all([
          fetchAdmin('/stats', token),
          fetchAdmin('/crawl-runs', token),
          fetchAdmin('/content-breakdown', token),
          fetchAdmin('/embedding-status', token),
        ])
        setStats(s)
        setCrawlRuns(c.runs)
        setContentTypes(b.content_types)
        setSections(b.sections)
        setEmbeddings(e.breakdown)
      } catch {
        clearToken()
        window.location.reload()
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  if (loading) return <p className="text-gray-400 mt-20 text-center">Loading...</p>

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zeever-text">Admin Dashboard</h1>
        <button
          onClick={() => { clearToken(); window.location.reload() }}
          className="text-xs text-gray-400 hover:text-zeever-text transition-colors"
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
            <StatCard label="Searchable chunks" value={stats.embedded} />
            <StatCard label="Parsed PDFs" value={stats.parsed_pdfs} />
          </div>

          {/* Actionable gaps */}
          {(stats.awaiting_parse > 0 || stats.unparsed_html > 0 || stats.unembedded > 0) && (
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
            </div>
          )}

          {/* Non-actionable info */}
          <div className="bg-white rounded-xl border border-zeever-accent/20 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Coverage info</p>
            {stats.awaiting_parse === 0 && stats.unparsed_html === 0 && stats.unembedded === 0 && (
              <p className="text-sm text-green-600">All content is parsed and embedded. No action needed.</p>
            )}
            <p className="text-sm text-gray-500">
              <span className="font-mono text-gray-400">{stats.uncrawled_pdfs.toLocaleString()}</span> PDF link references (discovered but not downloaded, expected)
            </p>
            {stats.empty_chunks > 0 && (
              <p className="text-sm text-gray-500">
                <span className="font-mono text-gray-400">{stats.empty_chunks.toLocaleString()}</span> empty chunks (scanned PDFs with no extractable text)
              </p>
            )}
            <p className="text-sm text-gray-500">
              <span className="font-mono text-gray-400">{stats.graph_nodes.toLocaleString()}</span> graph nodes, <span className="font-mono text-gray-400">{stats.graph_edges.toLocaleString()}</span> graph edges
            </p>
          </div>
        </div>
      )}

      {/* Pipeline controls */}
      <PipelinePanel token={token} />

      {/* PDF Download */}
      <PdfDownloadPanel token={token} />

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
  const [token, setToken] = useState<string>('')

  useEffect(() => {
    setToken(getToken())
  }, [])

  if (!token) {
    return <LoginForm onLogin={setToken} />
  }

  return <Dashboard token={token} />
}
