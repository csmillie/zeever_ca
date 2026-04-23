"""Input sanitization and prompt injection detection.

Provides three layers of protection:
1. sanitize_query() - strips known injection patterns from user input
2. is_suspicious() - flags queries that look like injection attempts for logging
3. sanitize_context() - strips injection patterns from retrieved chunks
"""
import re
import logging

logger = logging.getLogger("zeever.security")

# Patterns that indicate prompt injection attempts.
# These are stripped from user input before it reaches the LLM.
INJECTION_PATTERNS = [
    # Role/identity manipulation (match through end of sentence or end of string)
    r"(?i)ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)[^.!?]*[.!?]?\s*",
    r"(?i)disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)[^.!?]*[.!?]?\s*",
    r"(?i)forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)[^.!?]*[.!?]?\s*",
    r"(?i)you\s+are\s+now\s+[^.!?]*[.!?]?\s*",
    r"(?i)act\s+as\s+(if\s+you\s+are\s+)?[^.!?]*[.!?]?\s*",
    r"(?i)pretend\s+(you\s+are|to\s+be)\s+[^.!?]*[.!?]?\s*",
    r"(?i)roleplay\s+as\s+[^.!?]*[.!?]?\s*",
    r"(?i)switch\s+to\s+[^.!?]*mode[^.!?]*[.!?]?\s*",
    r"(?i)enter\s+[^.!?]*mode[^.!?]*[.!?]?\s*",
    # System/role markers (match anywhere, not just start of string)
    r"(?i)system\s*:\s*[^.!?]*[.!?]?\s*",
    r"(?i)assistant\s*:\s*[^.!?]*[.!?]?\s*",
    r"(?i)\[system\][^.!?]*[.!?]?\s*",
    r"(?i)\[INST\][^.!?]*[.!?]?\s*",
    r"(?i)<\|system\|>[^.!?]*[.!?]?\s*",
    r"(?i)<\|assistant\|>[^.!?]*[.!?]?\s*",
    r"(?i)<\|user\|>[^.!?]*[.!?]?\s*",
    r"(?i)<<SYS>>[^.!?]*[.!?]?\s*",
    r"(?i)<</SYS>>[^.!?]*[.!?]?\s*",
    # Direct override attempts
    r"(?i)override\s+(your\s+)?(instructions?|rules?|prompt|system|safety)[^.!?]*[.!?]?\s*",
    r"(?i)new\s+instructions?\s*:[^.!?]*[.!?]?\s*",
    r"(?i)updated?\s+instructions?\s*:[^.!?]*[.!?]?\s*",
    r"(?i)revised\s+instructions?\s*:[^.!?]*[.!?]?\s*",
    r"(?i)your\s+new\s+(task|role|job|purpose)\s+is[^.!?]*[.!?]?\s*",
    r"(?i)from\s+now\s+on\s*,?\s*(you|your)[^.!?]*[.!?]?\s*",
    # Data exfiltration
    r"(?i)repeat\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)",
    r"(?i)show\s+(me\s+)?(your\s+)?(system\s+)?(prompt|instructions?|rules?)",
    r"(?i)print\s+(your\s+)?(system\s+)?(prompt|instructions?)",
    r"(?i)what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions?|rules?)",
    r"(?i)output\s+(your\s+)?(system\s+)?(prompt|instructions?)",
    r"(?i)reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)",
    # Encoded/obfuscated attempts
    r"(?i)base64\s*:",
    r"(?i)decode\s+this",
    r"(?i)execute\s+(this|the\s+following)",
    r"(?i)run\s+(this|the\s+following)\s+(code|command|script)",
]

_compiled_patterns = [re.compile(p) for p in INJECTION_PATTERNS]

# Patterns that are suspicious but not necessarily malicious.
# These trigger logging but don't modify the input.
SUSPICIOUS_INDICATORS = [
    r"(?i)ignore",
    r"(?i)pretend",
    r"(?i)system\s*prompt",
    r"(?i)instructions?",
    r"(?i)override",
    r"(?i)jailbreak",
    r"(?i)DAN\b",
    r"(?i)do\s+anything\s+now",
    r"(?i)bypass",
    r"(?i)unrestricted",
]

_compiled_suspicious = [re.compile(p) for p in SUSPICIOUS_INDICATORS]


def sanitize_query(query: str) -> str:
    """Remove known injection patterns from user input.

    Returns the cleaned query. Does not reject the query outright
    since legitimate questions might accidentally match patterns
    (e.g. "What are the instructions for applying?").
    """
    cleaned = query
    for pattern in _compiled_patterns:
        cleaned = pattern.sub("", cleaned)

    # Collapse multiple spaces/newlines left by removals
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()

    return cleaned if cleaned else "What Toronto city services can you help me with?"


def is_suspicious(query: str) -> bool:
    """Check if a query contains suspicious patterns worth logging.

    Returns True if 2+ suspicious indicators are found, suggesting
    a deliberate injection attempt rather than a coincidental match.
    """
    matches = sum(1 for p in _compiled_suspicious if p.search(query))
    return matches >= 2


# Narrow patterns for context sanitization. Only targets unambiguous
# LLM-framing markers that cannot appear in legitimate Toronto.ca content.
# Broader patterns like "act as" or "system:" are too risky for trusted
# content (e.g. "act as your authorized representative", "permit system: ...").
CONTEXT_PATTERNS = [
    r"\[INST\][^.!?]*[.!?]?\s*",
    r"\[/INST\][^.!?]*[.!?]?\s*",
    r"<<SYS>>[^.!?]*[.!?]?\s*",
    r"<</SYS>>[^.!?]*[.!?]?\s*",
    r"<\|system\|>[^.!?]*[.!?]?\s*",
    r"<\|assistant\|>[^.!?]*[.!?]?\s*",
    r"<\|user\|>[^.!?]*[.!?]?\s*",
    r"<\|im_start\|>[^.!?]*[.!?]?\s*",
    r"<\|im_end\|>[^.!?]*[.!?]?\s*",
    r"(?i)ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)[^.!?]*[.!?]?\s*",
    r"(?i)disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)[^.!?]*[.!?]?\s*",
]

_compiled_context_patterns = [re.compile(p) for p in CONTEXT_PATTERNS]


def sanitize_context(chunk_text: str) -> str:
    """Strip LLM-framing markers from retrieved document chunks.

    Uses a narrow pattern set targeting only unambiguous injection
    markers (template tokens, explicit instruction overrides) that
    cannot appear in legitimate Toronto.ca content. Broader patterns
    like "act as" or "system:" are not applied here to avoid
    corrupting real permit language.
    """
    cleaned = chunk_text
    for pattern in _compiled_context_patterns:
        cleaned = pattern.sub("", cleaned)
    return cleaned


def log_suspicious_query(query: str, client_ip: str):
    """Log a suspicious query for security monitoring."""
    # Truncate for logging to avoid log injection
    safe_query = query[:500].replace("\n", " ").replace("\r", "")
    logger.warning(
        "Suspicious query detected | ip=%s | query=%s",
        client_ip,
        safe_query,
    )
