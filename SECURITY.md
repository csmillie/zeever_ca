# Security Policy

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Email: `colin [at] zeever [dot] ca`

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment:** within 72 hours
- **Assessment:** within 1 week
- **Fix or mitigation:** depends on severity, but we aim for 30 days

## Scope

We're interested in:
- Prompt injection bypasses
- Authentication or authorization flaws
- Data exposure (PII, credentials, internal paths)
- Dependency vulnerabilities with known exploits
- Cross-site scripting (XSS) or injection attacks

## Out of Scope

- Rate limiting thresholds (documented behavior)
- Denial of service via excessive crawling (use responsible disclosure)
- Vulnerabilities in third-party services we depend on (report to them directly)

## Recognition

We'll credit reporters in the fix commit and release notes unless they prefer to remain anonymous.
