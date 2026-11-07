export const MCP_PROTOCOL_VERSION = '2025-06-18';

export const MCP_SERVER_INFO = {
  name: 'zeever-ca',
  version: '1.0.0',
} as const;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: string | number | null;
  result: unknown;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

export type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

export const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'ask_toronto',
    description:
      'Ask a question about any City of Toronto service. Returns a cited answer grounded in official Toronto.ca content.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description:
            'Question about Toronto city services (e.g., "How do I get a building permit?")',
          maxLength: 750,
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_toronto_services',
    description:
      'Search for Toronto city services by topic. Returns a list of relevant service categories with cited sources.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Service topic to search for (e.g., "recycling", "parking permits")',
          maxLength: 200,
        },
      },
      required: ['topic'],
      additionalProperties: false,
    },
  },
];
