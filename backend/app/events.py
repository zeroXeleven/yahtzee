"""In-memory pub/sub for live game updates over SSE.

Each game code maps to a set of asyncio Queues, one per connected client. When a
mutation commits, the route calls ``notify(code)``, which wakes every subscriber
so they re-fetch the game state.

This lives in process memory, so it is correct for a **single worker** — which
the self-hosted single-container deploy is. Scaling to multiple workers would
need a shared bus (e.g. Redis); intentionally out of scope here.

``notify`` is called from FastAPI's sync route handlers, which run in a thread
pool, so it hops back onto the event loop via ``call_soon_threadsafe``.
"""

import asyncio
from collections import defaultdict

_subscribers: dict[str, set[asyncio.Queue]] = defaultdict(set)
_loop: asyncio.AbstractEventLoop | None = None


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Record the main event loop (called once at app startup)."""
    global _loop
    _loop = loop


def subscribe(code: str) -> asyncio.Queue:
    """Register a subscriber for a game. Call from the event loop (SSE handler)."""
    q: asyncio.Queue = asyncio.Queue(maxsize=8)
    _subscribers[code].add(q)
    return q


def unsubscribe(code: str, q: asyncio.Queue) -> None:
    subs = _subscribers.get(code)
    if subs:
        subs.discard(q)
        if not subs:
            _subscribers.pop(code, None)


def notify(code: str) -> None:
    """Wake all subscribers for a game. Safe to call from any thread."""
    if _loop is None:
        return
    subs = _subscribers.get(code)
    if not subs:
        return
    for q in list(subs):
        _loop.call_soon_threadsafe(_safe_put, q)


def _safe_put(q: asyncio.Queue) -> None:
    # A full queue already has a pending wake-up, so dropping is fine.
    try:
        q.put_nowait(1)
    except asyncio.QueueFull:
        pass
