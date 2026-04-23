import { describe, it, expect, beforeEach } from 'vitest'
import {
  TEMPLATES,
  FOLLOWUPS_ENABLED,
  ROTATION_WINDOW,
  classifyForFollowUp,
  getFollowUp,
  resetFollowUps,
} from '../followups'

describe('followups config and templates', () => {
  it('has FOLLOWUPS_ENABLED set to true', () => {
    expect(FOLLOWUPS_ENABLED).toBe(true)
  })

  it('has ROTATION_WINDOW set to 3', () => {
    expect(ROTATION_WINDOW).toBe(3)
  })

  it('has templates for all expected categories', () => {
    const expected = [
      'general', 'process', 'documents', 'conditional',
      'fees', 'inspections', 'jurisdiction', 'comparison', 'eligibility',
    ]
    for (const cat of expected) {
      expect(TEMPLATES[cat]).toBeDefined()
      expect(TEMPLATES[cat].length).toBeGreaterThanOrEqual(4)
    }
  })

  it('all templates are non-empty strings', () => {
    for (const [, pool] of Object.entries(TEMPLATES)) {
      for (const t of pool) {
        expect(typeof t).toBe('string')
        expect(t.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('classifyForFollowUp', () => {
  it('maps known queryClass values directly', () => {
    expect(classifyForFollowUp('process', 'You need to apply first.')).toBe('process')
    expect(classifyForFollowUp('documents', 'Submit form A.')).toBe('documents')
    expect(classifyForFollowUp('fees', 'The fee is $200.')).toBe('fees')
    expect(classifyForFollowUp('inspections', 'An inspector will visit.')).toBe('inspections')
    expect(classifyForFollowUp('conditional', 'It depends on your zone.')).toBe('conditional')
  })

  it('falls back to general for unknown queryClass', () => {
    expect(classifyForFollowUp('unknown_class', 'Some answer.')).toBe('general')
  })

  it('overrides queryClass with jurisdiction when answer mentions province', () => {
    expect(classifyForFollowUp('general', 'This is a provincial matter handled by the federal government.')).toBe('jurisdiction')
  })

  it('overrides queryClass with comparison when answer mentions versus', () => {
    expect(classifyForFollowUp('general', 'Compared to the old process, this is faster.')).toBe('comparison')
  })

  it('overrides queryClass with eligibility when answer mentions qualify', () => {
    expect(classifyForFollowUp('general', 'You must qualify based on income.')).toBe('eligibility')
  })

  it('keyword enrichment takes priority over direct queryClass', () => {
    expect(classifyForFollowUp('fees', 'The provincial fee differs from the municipal one.')).toBe('jurisdiction')
  })
})

describe('getFollowUp', () => {
  beforeEach(() => {
    resetFollowUps()
  })

  it('returns a string from the correct template pool', () => {
    const result = getFollowUp('process', 'Apply for the permit.')
    expect(result).not.toBeNull()
    expect(TEMPLATES.process).toContain(result)
  })

  it('returns a string when enabled', () => {
    const result = getFollowUp('general', 'Some answer.')
    expect(typeof result).toBe('string')
  })

  it('does not repeat within rotation window of 3', () => {
    const seen: string[] = []
    for (let i = 0; i < 4; i++) {
      const result = getFollowUp('general', 'Some answer.')
      expect(result).not.toBeNull()
      seen.push(result!)
    }
    // No adjacent pair should be the same
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).not.toBe(seen[i - 1])
    }
  })

  it('recovers when pool is exhausted by rotation window', () => {
    for (let i = 0; i < 12; i++) {
      const result = getFollowUp('general', 'Some answer.')
      expect(result).not.toBeNull()
      expect(typeof result).toBe('string')
    }
  })

  it('uses keyword-enriched category for template selection', () => {
    const result = getFollowUp('general', 'You may qualify if you meet requirements.')
    expect(result).not.toBeNull()
    expect(TEMPLATES.eligibility).toContain(result)
  })
})
