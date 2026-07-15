"""Player profiles — the passwordless "who are you" list."""

import sqlite3

from fastapi import APIRouter, HTTPException

from ..db import get_db
from ..models import PlayerCreate

router = APIRouter(tags=["players"])


@router.get("/players")
def list_players():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, name, color FROM players ORDER BY name COLLATE NOCASE"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/players", status_code=201)
def create_player(body: PlayerCreate):
    conn = get_db()
    try:
        cur = conn.execute(
            "INSERT INTO players (name, color) VALUES (?, ?)",
            (body.name.strip(), body.color),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, name, color FROM players WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)
    except sqlite3.IntegrityError:
        raise HTTPException(409, f"a player named '{body.name.strip()}' already exists")
    finally:
        conn.close()
