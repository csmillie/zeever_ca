---
name: ask-toronto
description: Ask questions about City of Toronto services and get cited answers from official Toronto.ca content
version: 1.0.0
---

# Ask Toronto

Query the Zeever.ca AI assistant about any City of Toronto service.

## Endpoint

POST https://www.zeever.ca/api/query

## Request

```json
{
  "question": "How do I apply for a building permit?"
}
```

## Response

Returns a JSON object with:
- `answer`: Cited answer grounded in Toronto.ca content
- `sources`: Array of source URLs from Toronto.ca

## Coverage

All City of Toronto services including:
- Building permits and zoning
- Property taxes and utilities
- Waste and recycling
- Parking and transit
- Housing and shelters
- Recreation programs
- Bylaws and licensing

## Limitations

- Only covers City of Toronto (not provincial/federal)
- Answers grounded in crawled Toronto.ca content
- Rate limited to 20 requests per minute
