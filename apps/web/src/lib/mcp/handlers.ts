import { timingSafeEqual } from 'crypto';
import {
  ERR,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_INFO,
  MCP_TOOLS,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from './types';

const API_URL = process.env.API_URL || 'http://localhost:3034';

export function checkMcpApiKey(authHeader: string | null): boolean {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) return true;
  if (!authHeader) return false;
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token.length !== apiKey.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(apiKey));
}

function ok(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

function err(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

interface QueryBackendResult {
  answer: string;
  sources: Array<{ url: string; title?: string }>;
  query_class?: string;
  model_used?: string;
}

async function callQueryBackend(question: string): Promise<QueryBackendResult> {
  const res = await fetch(`${API_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Self-hosted only. /api/mcp has the same fail-open auth as /a2a, so the
    // same reasoning applies: a caller that never authenticated must not be
    // able to run up a metered inference bill.
    body: JSON.stringify({ question, provider: 'local' }),
  });
  if (!res.ok) {
    throw new Error(`backend ${res.status}`);
  }
  return (await res.json()) as QueryBackendResult;
}

async function runTool(name: string, args: Record<string, unknown>) {
  if (name === 'ask_toronto') {
    const question = typeof args.question === 'string' ? args.question : '';
    if (!question || question.length > 750) {
      throw new Error('Invalid "question": must be a string up to 750 chars.');
    }
    const data = await callQueryBackend(question);
    return {
      content: [{ type: 'text', text: data.answer }],
      structuredContent: {
        answer: data.answer,
        sources: data.sources,
        query_class: data.query_class,
        model_used: data.model_used,
      },
      isError: false,
    };
  }

  if (name === 'search_toronto_services') {
    const topic = typeof args.topic === 'string' ? args.topic : '';
    if (!topic || topic.length > 200) {
      throw new Error('Invalid "topic": must be a string up to 200 chars.');
    }
    const data = await callQueryBackend(
      `What Toronto city services are available for: ${topic}`,
    );
    return {
      content: [{ type: 'text', text: data.answer }],
      structuredContent: {
        topic,
        answer: data.answer,
        sources: data.sources,
        query_class: data.query_class,
        model_used: data.model_used,
      },
      isError: false,
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function handleJsonRpc(body: unknown): Promise<JsonRpcResponse | null> {
  if (!body || typeof body !== 'object') {
    return err(null, ERR.INVALID_REQUEST, 'Invalid request: not an object.');
  }
  const req = body as JsonRpcRequest;
  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return err(req.id ?? null, ERR.INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request.');
  }

  const isNotification = req.id === undefined;
  const id = req.id ?? null;

  try {
    switch (req.method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions:
            'Civic AI assistant for Toronto. Ask questions about any City of Toronto service; answers are grounded in toronto.ca content with citations.',
        });

      case 'notifications/initialized':
      case 'notifications/cancelled':
        return isNotification ? null : ok(id, {});

      case 'ping':
        return ok(id, {});

      case 'tools/list':
        return ok(id, { tools: MCP_TOOLS });

      case 'tools/call': {
        const params = req.params ?? {};
        const name = typeof params.name === 'string' ? params.name : '';
        const args =
          params.arguments && typeof params.arguments === 'object'
            ? (params.arguments as Record<string, unknown>)
            : {};
        if (!name) {
          return err(id, ERR.INVALID_PARAMS, 'Missing "name" in tools/call params.');
        }
        try {
          const result = await runTool(name, args);
          return ok(id, result);
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Tool execution failed.';
          return ok(id, {
            content: [{ type: 'text', text: message }],
            isError: true,
          });
        }
      }

      default:
        if (isNotification) return null;
        return err(id, ERR.METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal error.';
    return err(id, ERR.INTERNAL, message);
  }
}
