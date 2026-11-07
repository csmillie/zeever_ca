import { timingSafeEqual } from 'crypto';
import type { A2ARequest, A2AResponse, SkillId } from './types';
import { SKILL_IDS, MAX_QUERY_LENGTH, MAX_LIMIT, AGENT_NAME } from './types';
import { torontoCivicLookup } from './skills/toronto-civic-lookup';
import { sovereignAiResearch } from './skills/sovereign-ai-research';
import { sourceGroundedAnswer } from './skills/source-grounded-answer';

interface ValidationError {
  error: string;
  status: number;
}

export function validateA2ARequest(body: unknown): ValidationError | null {
  if (!body || typeof body !== 'object') {
    return { error: 'Invalid request body.', status: 400 };
  }

  const req = body as Record<string, unknown>;

  if (!req.skill || typeof req.skill !== 'string') {
    return { error: 'Missing or invalid "skill" field.', status: 400 };
  }

  if (!SKILL_IDS.includes(req.skill as SkillId)) {
    return {
      error: `Unsupported skill "${req.skill}". Supported: ${SKILL_IDS.join(', ')}`,
      status: 400,
    };
  }

  if (!req.query || typeof req.query !== 'string') {
    return { error: 'Missing or invalid "query" field.', status: 400 };
  }

  if (req.query.length > MAX_QUERY_LENGTH) {
    return {
      error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`,
      status: 400,
    };
  }

  if (req.context !== undefined) {
    if (typeof req.context !== 'object' || req.context === null) {
      return { error: 'Invalid "context" field.', status: 400 };
    }

    const ctx = req.context as Record<string, unknown>;
    if (ctx.limit !== undefined) {
      if (typeof ctx.limit !== 'number' || ctx.limit < 1 || ctx.limit > MAX_LIMIT) {
        return { error: `"context.limit" must be between 1 and ${MAX_LIMIT}.`, status: 400 };
      }
    }
  }

  return null;
}

export function checkApiKey(authHeader: string | null): boolean {
  const apiKey = process.env.A2A_API_KEY;
  if (!apiKey) return true;
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

export async function handleA2ARequest(body: A2ARequest): Promise<A2AResponse> {
  switch (body.skill) {
    case 'toronto_civic_lookup':
      return torontoCivicLookup(body.query, body.context);
    case 'sovereign_ai_research':
      return sovereignAiResearch(body.query, body.context);
    case 'source_grounded_answer':
      return sourceGroundedAnswer(body.query, body.context);
    default:
      return {
        agent: AGENT_NAME,
        skill: body.skill,
        query: body.query,
        status: 'error',
        answer: 'Unsupported skill.',
        data: [],
        sources: [],
        warnings: ['unsupported_skill'],
      };
  }
}
