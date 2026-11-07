"""Who a request claims to be, and whether we believe it.

Both endpoints that cost money, /api/query and /api/query/stream, are proxied by
Apache straight to FastAPI. Next.js is not in the path, so the CSRF check in
apps/web/src/proxy.ts never runs for them. Verified against production on
2026-08-31: a POST to /api/query carrying `Origin: https://evil.example.com`
returned 200, as did one with no Origin at all.

CORS still stops a malicious page reading the answer, so this was never a
disclosure problem. It is that any site could make this server run a paid
generation, as often as it liked, because the rate limit key was a header the
caller controls.
"""
from unittest.mock import patch

from fastapi import Request

from query_engine.limiter import real_ip


def _request(headers: dict, client: str = "127.0.0.1") -> Request:
    """A Starlette request with the given headers and transport address."""
    raw = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    return Request({"type": "http", "headers": raw, "client": (client, 1234),
                    "method": "POST", "path": "/api/query", "scheme": "https",
                    "server": ("zeever.ca", 443), "query_string": b""})


def test_cloudflare_header_wins():
    """Cloudflare overwrites CF-Connecting-IP on every request, so it is the one
    header a caller cannot forge without bypassing Cloudflare entirely."""
    assert real_ip(_request({"cf-connecting-ip": "203.0.113.7",
                             "x-real-ip": "1.1.1.1"})) == "203.0.113.7"


def test_x_real_ip_is_the_fallback():
    """The Next.js proxy sets it deliberately on the admin path."""
    assert real_ip(_request({"x-real-ip": "203.0.113.7"})) == "203.0.113.7"


def test_transport_address_is_the_last_resort():
    assert real_ip(_request({}, client="198.51.100.4")) == "198.51.100.4"


def test_a_spoofed_x_real_ip_no_longer_picks_the_bucket():
    """The regression. Apache forwards client headers unchanged to FastAPI, so a
    caller who set X-Real-IP chose their own rate-limit key and could change it
    per request, making the 20/minute limit on paid generation meaningless."""
    spoofed = _request({"cf-connecting-ip": "203.0.113.7",
                        "x-real-ip": "attacker-picked-this"})
    assert real_ip(spoofed) == "203.0.113.7"


def test_whitespace_is_stripped():
    assert real_ip(_request({"cf-connecting-ip": " 203.0.113.7 "})) == "203.0.113.7"


# --- the cross-site guard -----------------------------------------------------

def _client():
    from fastapi.testclient import TestClient
    import query_engine.api as api
    return TestClient(api.app), api


def test_a_foreign_origin_is_refused():
    client, _ = _client()
    r = client.post("/api/query", json={"question": "hi"},
                    headers={"Origin": "https://evil.example.com"})
    assert r.status_code == 403


def test_a_missing_origin_is_allowed():
    """Deliberate. The benchmark, the eval suite and the server-side A2A and MCP
    skills all call this API without an Origin, and a browser always sends one on
    a cross-site POST, so requiring it would break every legitimate non-browser
    caller while blocking nothing a browser does."""
    client, api = _client()
    with patch.object(api, "traced_classify", return_value="general"), \
         patch.object(api, "traced_retrieve", return_value=([], None)):
        r = client.post("/api/query", json={"question": "hi"})
    assert r.status_code != 403


def test_our_own_origin_is_allowed():
    client, api = _client()
    with patch.object(api, "traced_classify", return_value="general"), \
         patch.object(api, "traced_retrieve", return_value=([], None)):
        r = client.post("/api/query", json={"question": "hi"},
                        headers={"Origin": "https://www.zeever.ca"})
    assert r.status_code != 403


def test_a_get_is_not_blocked():
    """The guard is for state-changing and cost-incurring POSTs. /health must
    stay reachable however it is called."""
    client, _ = _client()
    assert client.get("/health").status_code == 200
