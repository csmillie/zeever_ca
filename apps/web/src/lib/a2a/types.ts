export const SKILL_IDS = [
  'toronto_civic_lookup',
  'sovereign_ai_research',
  'source_grounded_answer',
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

export interface A2ARequestContext {
  limit?: number;
  includeSources?: boolean;
  jurisdiction?: string;
  freshness?: string;
}

export interface A2ARequest {
  skill: SkillId;
  query: string;
  context?: A2ARequestContext;
}

export interface A2ASource {
  url: string;
  title: string;
}

export interface A2AResponseMeta {
  type: 'response_meta';
  model_used?: string;
  query_class?: string;
  source_count: number;
}

export interface A2ASourceRecord {
  type: 'source';
  rank: number;
  url: string;
  title: string;
}

export interface A2AResearchArticle {
  type: 'research_article';
  rank: number;
  slug: string;
  url: string;
  title: string;
  description: string;
  date: string;
  match_score: number;
  matched_keywords: string[];
}

export type A2ADataItem = A2AResponseMeta | A2ASourceRecord | A2AResearchArticle;

export interface A2AResponse {
  agent: string;
  skill: SkillId;
  query: string;
  status: 'completed' | 'error';
  answer: string;
  data: A2ADataItem[];
  sources: A2ASource[];
  warnings: string[];
}

export const AGENT_NAME = 'Zeever Canadian Civic AI Agent';
export const MAX_QUERY_LENGTH = 750;
export const MAX_LIMIT = 10;
export const DEFAULT_LIMIT = 5;
