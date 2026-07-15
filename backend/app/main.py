"""FastAPI entrypoint.

In development the React app runs on the Vite dev server (separate container) and
proxies ``/api`` here. In production the built frontend is copied to ``app/static``
and served by this same process, so the whole app ships as one container.
"""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import events
from .db import init_db
from .routes import games, players, stats


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    events.set_loop(asyncio.get_running_loop())
    yield


app = FastAPI(title="Yahtzee Scorekeeper", lifespan=lifespan)

app.include_router(players.router, prefix="/api")
app.include_router(games.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the built frontend in production (present only after the image build).
_static_dir = Path(__file__).parent / "static"
if _static_dir.is_dir():
    app.mount("/", StaticFiles(directory=str(_static_dir), html=True), name="static")
