import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { agentCard } from '../a2a/agent-card'
import { validateA2ARequest, checkApiKey, handleA2ARequest } from '../a2a/handlers'
import { checkRateLimit } from '../a2a/rate-limit'
import { SKILL_IDS, MAX_QUERY_LENGTH, AGENT_NAME } from '../a2a/types'

// Mock fetch for backend calls
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockBackendResponse(answer: string, sources: { url: string; title: string }[] = []) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ answer, sources, query_class: 'general', model_used: 'test' }),
  })
}

describe('Agent Card', () => {
  it('returns valid JSON with required fields', () => {
    expect(agentCard.name).toBe('Zeever Canadian Civic AI Agent')
    expect(agentCard.url).toBe('https://www.zeever.ca/a2a')
    expect(agentCard.version).toBe('0.1.0')
    expect(agentCard.protocolVersion).toBe('0.2.6')
    expect(agentCard.capabilities).toEqual({ streaming: false, pushNotifications: false })
    expect(agentCard.skills).toHaveLength(3)
  })

  it('has all three skill IDs', () => {
    const skillIds = agentCard.skills.map((s) => s.id)
    expect(skillIds).toContain('toronto_civic_lookup')
    expect(skillIds).toContain('sovereign_ai_research')
    expect(skillIds).toContain('source_grounded_answer')
  })
})

describe('Request validation', () => {
  it('rejects missing skill', () => {
    const err = validateA2ARequest({ query: 'hello' })
    expect(err?.status).toBe(400)
    expect(err?.error).toContain('skill')
  })

  it('rejects unsupported skill', () => {
    const err = validateA2ARequest({ skill: 'hack_the_planet', query: 'hello' })
    expect(err?.status).toBe(400)
    expect(err?.error).toContain('Unsupported skill')
  })

  it('rejects missing query', () => {
    const err = validateA2ARequest({ skill: 'toronto_civic_lookup' })
    expect(err?.status).toBe(400)
    expect(err?.error).toContain('query')
  })

  it('rejects query over max length', () => {
    const err = validateA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'x'.repeat(MAX_QUERY_LENGTH + 1),
    })
    expect(err?.status).toBe(400)
    expect(err?.error).toContain('maximum length')
  })

  it('rejects limit over 10', () => {
    const err = validateA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'hello',
      context: { limit: 11 },
    })
    expect(err?.status).toBe(400)
    expect(err?.error).toContain('limit')
  })

  it('accepts valid request', () => {
    const err = validateA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'How do I get a building permit?',
      context: { limit: 3, includeSources: true },
    })
    expect(err).toBeNull()
  })

  it('accepts request without context', () => {
    const err = validateA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'property taxes',
    })
    expect(err).toBeNull()
  })
})

describe('API key check', () => {
  const originalEnv = process.env.A2A_API_KEY

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.A2A_API_KEY = originalEnv
    } else {
      delete process.env.A2A_API_KEY
    }
  })

  it('allows access when A2A_API_KEY is not set', () => {
    delete process.env.A2A_API_KEY
    expect(checkApiKey(null)).toBe(true)
    expect(checkApiKey('Bearer anything')).toBe(true)
  })

  it('requires valid key when A2A_API_KEY is set', () => {
    process.env.A2A_API_KEY = 'test-secret-key'
    expect(checkApiKey(null)).toBe(false)
    expect(checkApiKey('Bearer wrong-key')).toBe(false)
    expect(checkApiKey('Bearer test-secret-key')).toBe(true)
  })

  it('rejects missing Bearer prefix', () => {
    process.env.A2A_API_KEY = 'test-key'
    expect(checkApiKey('test-key')).toBe(false)
  })
})

describe('Skill handlers', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('toronto_civic_lookup returns completed response', async () => {
    mockBackendResponse('You need form X.', [
      { url: 'https://toronto.ca/permits', title: 'Building Permits' },
    ])

    const result = await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'How do I get a building permit?',
    })

    expect(result.agent).toBe(AGENT_NAME)
    expect(result.skill).toBe('toronto_civic_lookup')
    expect(result.status).toBe('completed')
    expect(result.answer).toBe('You need form X.')
    expect(result.sources).toHaveLength(1)
    expect(result.sources[0].url).toBe('https://toronto.ca/permits')
  })

  it('sovereign_ai_research returns matching articles', async () => {
    const result = await handleA2ARequest({
      skill: 'sovereign_ai_research',
      query: 'Canadian AI inference compute',
    })

    expect(result.status).toBe('completed')
    expect(result.sources.length).toBeGreaterThan(0)
    expect(result.sources.some((s) => s.url.includes('canadian-inference'))).toBe(true)
  })

  it('sovereign_ai_research returns warning for no matches', async () => {
    const result = await handleA2ARequest({
      skill: 'sovereign_ai_research',
      query: 'quantum teleportation recipes',
    })

    expect(result.status).toBe('completed')
    expect(result.warnings).toContain('no_matching_research')
    expect(result.sources).toHaveLength(0)
  })

  it('source_grounded_answer returns completed response', async () => {
    mockBackendResponse('The answer is 42.', [
      { url: 'https://toronto.ca/info', title: 'Info Page' },
    ])

    const result = await handleA2ARequest({
      skill: 'source_grounded_answer',
      query: 'What is the meaning of everything?',
    })

    expect(result.status).toBe('completed')
    expect(result.answer).toBe('The answer is 42.')
    expect(result.sources).toHaveLength(1)
  })

  it('handles backend errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'test query',
    })

    expect(result.status).toBe('error')
    expect(result.warnings).toContain('backend_unavailable')
  })

  it('handles connection errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const result = await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'test query',
    })

    expect(result.status).toBe('error')
    expect(result.warnings).toContain('connection_error')
  })
})

describe('Cost protection', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  // /a2a is reachable by anything that can make an HTTP request, and
  // checkApiKey() returns true when A2A_API_KEY is unset, so an unauthenticated
  // caller must not be able to spend money. Every skill that reaches the
  // backend pins itself to self-hosted inference; the API then builds a chain
  // of local links only and fails rather than falling back to a paid provider.
  // `as const` so these stay the literal union SkillId rather than widening to
  // string. vitest strips types without checking them, so the missing assertion
  // passed 53 tests locally and only failed in CI, where `next build` runs tsc
  // across the whole project including this file.
  for (const skill of ['toronto_civic_lookup', 'source_grounded_answer'] as const) {
    it(`${skill} pins the request to local inference`, async () => {
      mockBackendResponse('An answer.')

      await handleA2ARequest({ skill, query: 'How do I get a building permit?' })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.provider).toBe('local')
    })
  }

  it('never asks for a named paid provider', async () => {
    mockBackendResponse('An answer.')

    await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'How do I get a building permit?',
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    // Asserted by exclusion: a future edit that swaps 'local' for a provider
    // name, or adds a model override, should fail here rather than quietly
    // start billing an endpoint that may have no authentication.
    expect(body.provider).toBe('local')
    expect(body.model).toBeUndefined()
  })
})

describe('Response safety', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('never includes embeddings in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        answer: 'test',
        sources: [{ url: 'https://toronto.ca/x', title: 'X', embedding: [0.1, 0.2] }],
        query_class: 'general',
        model_used: 'test',
        embedding: [0.1, 0.2, 0.3],
      }),
    })

    const result = await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'test',
    })

    const json = JSON.stringify(result)
    expect(json).not.toContain('embedding')
  })

  it('never includes prompts or trace IDs', async () => {
    mockBackendResponse('answer')

    const result = await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'test',
    })

    const json = JSON.stringify(result)
    expect(json).not.toContain('prompt')
    expect(json).not.toContain('trace_id')
    expect(json).not.toContain('api_key')
    expect(json).not.toContain('langfuse')
  })

  it('response only contains expected fields', async () => {
    mockBackendResponse('answer', [{ url: 'https://toronto.ca/x', title: 'X' }])

    const result = await handleA2ARequest({
      skill: 'toronto_civic_lookup',
      query: 'test',
    })

    const keys = Object.keys(result).sort()
    expect(keys).toEqual(['agent', 'answer', 'data', 'query', 'skill', 'sources', 'status', 'warnings'])
  })

  for (const skillId of SKILL_IDS) {
    it(`${skillId} returns valid response shape`, async () => {
      if (skillId !== 'sovereign_ai_research') {
        mockBackendResponse('test answer')
      }

      const result = await handleA2ARequest({
        skill: skillId,
        query: 'test query about Canadian AI',
      })

      expect(result.agent).toBe(AGENT_NAME)
      expect(result.skill).toBe(skillId)
      expect(['completed', 'error']).toContain(result.status)
      expect(typeof result.answer).toBe('string')
      expect(Array.isArray(result.data)).toBe(true)
      expect(Array.isArray(result.sources)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })
  }
})

describe('Rate limiting', () => {
  it('allows requests within limit', () => {
    const ip = `test-${Date.now()}`
    for (let i = 0; i < 20; i++) {
      expect(checkRateLimit(ip).allowed).toBe(true)
    }
  })

  it('blocks requests over 20 per minute', () => {
    const ip = `test-blocked-${Date.now()}`
    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip)
    }
    const result = checkRateLimit(ip)
    expect(result.allowed).toBe(false)
    expect(result.retryAfter).toBeGreaterThan(0)
  })

  it('allows different IPs independently', () => {
    const ts = Date.now()
    const ip1 = `test-a-${ts}`
    const ip2 = `test-b-${ts}`
    for (let i = 0; i < 20; i++) {
      checkRateLimit(ip1)
    }
    expect(checkRateLimit(ip1).allowed).toBe(false)
    expect(checkRateLimit(ip2).allowed).toBe(true)
  })
})
