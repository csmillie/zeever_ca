// Follow-up prompt templates and configuration.
// See docs/superpowers/specs/2026-04-15-followup-prompts-design.md

export const FOLLOWUPS_ENABLED = true
export const ROTATION_WINDOW = 3

export const TEMPLATES: Record<string, string[]> = {
  general: [
    'I can help make this more specific to your situation if you share a few details.',
    'Feel free to ask about a specific part of this. Happy to go deeper.',
    'I can narrow this down if you let me know which neighbourhood or service location works for you.',
    'Happy to dig deeper into any part of this, so let me know what\u2019s most useful.',
  ],
  process: [
    'I can walk you through the next step if you\u2019d like.',
    'I can break this into a short checklist if that would help.',
    'Let me know if you\u2019d like the timeline or fees. Happy to look those up.',
    'I can help figure out which step applies to you if you share a few details.',
  ],
  documents: [
    'I can help figure out which form applies if you tell me a bit more about your situation.',
    'Let me know if you need help with what to include. Happy to walk through it.',
    'I can look up the specific requirements if you tell me more about your document.',
    'Feel free to ask about submission deadlines. I can look those up for you.',
  ],
  conditional: [
    'I can make this more specific if you share a few details about your situation.',
    'Let me know which scenario applies to you and I can narrow it down from there.',
    'Happy to walk through the conditions if you tell me more about your case.',
    'I can help figure out which category you fall under if you\u2019d like.',
  ],
  fees: [
    'I can help estimate costs for your situation if you share a few details.',
    'Let me know if you\u2019d like to know about payment methods or fee waivers. Happy to check.',
    'I can look up the exact fee schedule if you tell me which service you need.',
    'Feel free to ask about additional costs or deposits. I can look into that.',
  ],
  inspections: [
    'I can help you know what to expect during the inspection. Just ask.',
    'Let me know if you need help scheduling or preparing. Happy to walk you through it.',
    'I can look up the specific requirements for your type of inspection if you\u2019d like.',
    'Feel free to ask what happens if the inspection doesn\u2019t pass. I can explain the next steps.',
  ],
  jurisdiction: [
    'I can make this more specific if you tell me your province, city, or postal code.',
    'Let me know which level of government you\u2019re dealing with and I can clarify from there.',
    'I can help sort out which office handles this if you share your location.',
    'Feel free to ask how this works for your municipality. Happy to look it up.',
  ],
  comparison: [
    'I can go deeper on either option. Let me know which sounds closer to what you need.',
    'Let me know if you\u2019d like a side-by-side breakdown. I can compare costs or timelines.',
    'I can help figure out which option fits best if you share a bit about your situation.',
    'Happy to explain the pros and cons in more detail. Just ask.',
  ],
  eligibility: [
    'I can help figure out if you qualify if you share a few details about your situation.',
    'Let me know your circumstances and I can check the eligibility criteria for you.',
    'I can walk through the requirements one by one if you\u2019d like.',
    'Feel free to share more details and I\u2019ll help you see where you stand.',
  ],
}

const KEYWORD_OVERRIDES: [RegExp, string][] = [
  [/\b(province|provincial|federal|municipal|city of|jurisdiction)\b/i, 'jurisdiction'],
  [/\b(compared to|versus|difference between|unlike)\b/i, 'comparison'],
  [/\b(eligib|qualify|qualifies|requirement.*met|must be)\b/i, 'eligibility'],
]

export function classifyForFollowUp(queryClass: string, answer: string): string {
  for (const [pattern, category] of KEYWORD_OVERRIDES) {
    if (pattern.test(answer)) return category
  }
  if (queryClass in TEMPLATES) return queryClass
  return 'general'
}

let recentFollowUps: string[] = []

/** Reset rotation state. Exported for testing. */
export function resetFollowUps(): void {
  recentFollowUps = []
}

export function getFollowUp(queryClass: string, answer: string): string | null {
  if (!FOLLOWUPS_ENABLED) return null

  const category = classifyForFollowUp(queryClass, answer)
  const pool = TEMPLATES[category] ?? TEMPLATES.general

  let candidates = pool.filter(t => !recentFollowUps.includes(t))

  if (candidates.length === 0) {
    recentFollowUps = []
    candidates = pool
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)]

  recentFollowUps.push(pick)
  if (recentFollowUps.length > ROTATION_WINDOW) {
    recentFollowUps.shift()
  }

  return pick
}
