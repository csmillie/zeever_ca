# A2A (Agent-to-Agent) Endpoint

Zeever.ca exposes a read-only A2A endpoint that lets external agents discover and query the Zeever Canadian Civic AI Agent. This enables machine-to-machine access to Toronto.ca civic knowledge and Zeever.ca's sovereign AI research.

## What is A2A?

A2A (Agent-to-Agent) is a protocol for agents to discover and interact with other agents. Unlike MCP (Model Context Protocol), which exposes tools and resources for LLMs to call, A2A exposes an agent's skills and capabilities so that other agents can delegate tasks to it.

| | A2A | MCP |
|---|---|---|
| **Purpose** | Agent discovers and delegates to another agent | LLM calls tools exposed by a server |
| **Interaction** | Skill-based task delegation | Tool/resource invocation |
| **Discovery** | `/.well-known/agent.json` | `/.well-known/mcp/server-card.json` |
| **Direction** | Agent → Agent | LLM → Server |

Zeever.ca supports both protocols. Use A2A when you want to ask Zeever a question and get a structured answer. Use MCP when you want to integrate Zeever as a tool in an LLM workflow.

## Discovery

Agent cards are available at two standard URLs:

```
GET https://www.zeever.ca/.well-known/agent.json
GET https://www.zeever.ca/.well-known/agent-card.json
```

Both return the same JSON response with `Cache-Control: public, max-age=3600`.

## Supported Skills

| Skill ID | Description |
|---|---|
| `toronto_civic_lookup` | Answer questions using indexed Toronto.ca public information. Returns source links. |
| `sovereign_ai_research` | Summarize Zeever.ca research about sovereign AI, Canadian compute, agentic AI, and governance. |
| `source_grounded_answer` | General query with source citations and uncertainty warnings when evidence is weak. |

## Example Request

```bash
curl -X POST https://www.zeever.ca/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "skill": "toronto_civic_lookup",
    "query": "How does the City of Toronto handle property tax relief for seniors?",
    "context": {
      "limit": 3,
      "includeSources": true,
      "jurisdiction": "Toronto"
    }
  }'
```

## Example Response

```json
{
  "agent": "Zeever Canadian Civic AI Agent",
  "skill": "toronto_civic_lookup",
  "query": "How does the City of Toronto handle property tax relief for seniors?",
  "status": "completed",
  "answer": "The City of Toronto offers property tax relief programs for eligible seniors, including the Tax Deferral Program and the Tax Cancellation Program. Eligibility is based on age (65+) and household income thresholds.",
  "data": [
    { "type": "response_meta", "model_used": "Qwen/Qwen2.5-7B-Instruct-Turbo", "query_class": "taxes", "source_count": 1 },
    { "type": "source", "rank": 1, "url": "https://www.toronto.ca/services-payments/property-taxes-utilities/property-tax/property-tax-relief/", "title": "Property Tax Relief" }
  ],
  "sources": [
    {
      "url": "https://www.toronto.ca/services-payments/property-taxes-utilities/property-tax/property-tax-relief/",
      "title": "Property Tax Relief"
    }
  ],
  "warnings": []
}
```

## Request Format

```json
{
  "skill": "toronto_civic_lookup | sovereign_ai_research | source_grounded_answer",
  "query": "string (max 750 characters)",
  "context": {
    "limit": "number (1-10, default 5)",
    "includeSources": "boolean (default true)",
    "jurisdiction": "string (optional, informational)",
    "freshness": "string (optional, informational)"
  }
}
```

## Response Format

```json
{
  "agent": "Zeever Canadian Civic AI Agent",
  "skill": "skill_id",
  "query": "original query",
  "status": "completed | error",
  "answer": "plain English answer",
  "data": [
    { "type": "response_meta", "model_used": "...", "query_class": "...", "source_count": 5 },
    { "type": "source", "rank": 1, "url": "...", "title": "..." }
  ],
  "sources": [{ "url": "...", "title": "..." }],
  "warnings": ["warning_code"]
}
```

### `data` item types

- `response_meta` — emitted once by `toronto_civic_lookup` and `source_grounded_answer`. Fields: `model_used`, `query_class`, `source_count`.
- `source` — ranked source records (one per cited URL). Fields: `rank`, `url`, `title`. Ordering matches `sources[]`.
- `research_article` — emitted by `sovereign_ai_research`. Fields: `rank`, `slug`, `url`, `title`, `description`, `date`, `match_score`, `matched_keywords`.

The `data` array is empty on error responses.

## Security

- **Read-only**: No write operations, no admin access, no database mutations.
- **API key** (optional): Set `A2A_API_KEY` environment variable to require `Authorization: Bearer <key>` header. When unset, the endpoint is publicly accessible.
- **Input validation**: Query max 750 chars, limit max 10, skill must be in allowlist.
- **No private data**: Responses never include embeddings, prompts, trace IDs, API keys, internal metadata, or draft content.
- **Timing-safe auth**: API key comparison uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Rate limiting**: 20 req/min per IP at the Next.js layer, plus backend enforcement via SlowAPI.

## Context-Window Guidance

Responses are designed to be compact for consuming agents:

- Answers are plain text, not markdown.
- Sources include only URL and title.
- The `data` array carries one `response_meta` record plus ranked `source`/`research_article` records.
- Default limit is 5 sources; max is 10.
- Warnings are short codes, not full sentences.

To minimize token usage, set `includeSources: false` if you only need the answer text. The `data` array still includes `response_meta` but omits `source` records when sources are suppressed.

## MCP JSON-RPC

Zeever also exposes an MCP-compatible JSON-RPC 2.0 server at `https://www.zeever.ca/api/mcp`. See `/.well-known/mcp/server-card.json` for the transport descriptor and `/llms-full.txt` for the integration guide. Methods supported: `initialize`, `tools/list`, `tools/call`, `ping`. Tools: `ask_toronto`, `search_toronto_services`.

## Error Responses

| Status | Meaning |
|---|---|
| 400 | Invalid request (bad JSON, unsupported skill, query too long) |
| 401 | Missing or invalid API key (only when `A2A_API_KEY` is set) |
| 405 | Method not allowed (only POST is supported) |
| 429 | Rate limit exceeded |

## Future Roadmap

- Streaming responses
- Push notifications for long-running queries
- GraphRAG-enhanced retrieval mode
- Outbound agent delegation
- Agent directory registration
- Usage tracking and analytics
