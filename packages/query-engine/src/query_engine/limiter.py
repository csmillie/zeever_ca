"""Shared slowapi limiter.

Lives in its own module so api.py and admin.py can both import it without
creating a circular dependency.

Rate limit keys come from the client's real address, not the transport
address, which behind Apache is always 127.0.0.1 and would make the limit a
single shared bucket for every caller.

`CF-Connecting-IP` is preferred because Cloudflare sets it itself, discarding
whatever the client sent. `X-Real-IP` is a fallback for the Next.js proxy, which
sets it deliberately on the admin path.

That fallback is trusted, and on `/api/query` it is client-controlled: Apache
proxies that path straight to FastAPI and forwards request headers unchanged, so
a caller who sets `X-Real-IP` picks their own rate-limit bucket and can change it
per request. Preferring CF-Connecting-IP closes that for traffic arriving through
Cloudflare, which is all of production. It assumes the origin is not reachable
directly; if the server's IP is ever exposed, both headers become spoofable again
and the limit has to move behind Cloudflare's own rate limiting.
"""
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def real_ip(request: Request) -> str:
    # Cloudflare overwrites this header on every request, so a client cannot
    # forge it without bypassing Cloudflare entirely.
    cf = request.headers.get("cf-connecting-ip")
    if cf:
        return cf.strip()
    forwarded = request.headers.get("x-real-ip")
    if forwarded:
        return forwarded.strip()
    return get_remote_address(request)


limiter = Limiter(key_func=real_ip)
