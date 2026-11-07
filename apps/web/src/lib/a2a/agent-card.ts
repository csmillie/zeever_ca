export const agentCard = {
  name: 'Zeever Canadian Civic AI Agent',
  description:
    'Answers questions using Zeever.ca\'s Canadian civic AI research and Toronto.ca knowledge corpus, with a focus on municipal services, public information, and sovereign AI analysis.',
  url: 'https://www.zeever.ca/a2a',
  version: '0.1.0',
  protocolVersion: '0.2.6',
  capabilities: {
    streaming: false,
    pushNotifications: false,
  },
  defaultInputModes: ['text/plain', 'application/json'],
  defaultOutputModes: ['text/plain', 'application/json'],
  skills: [
    {
      id: 'toronto_civic_lookup',
      name: 'Toronto civic knowledge lookup',
      description:
        'Answer questions using indexed Toronto.ca public information and return relevant source links.',
    },
    {
      id: 'sovereign_ai_research',
      name: 'Canadian sovereign AI research',
      description:
        'Summarize Zeever.ca research and analysis about sovereign AI, Canadian compute, agentic AI, and AI governance.',
    },
    {
      id: 'source_grounded_answer',
      name: 'Source-grounded answer',
      description:
        'Return a concise answer grounded in retrieved sources, with citations and uncertainty warnings when appropriate.',
    },
  ],
} as const;
