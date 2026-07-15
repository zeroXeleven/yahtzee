"""SQLite storage. One file on a mounted volume — no separate DB container.

Connections are opened per request and closed by the caller. Foreign keys are
enabled per connection (SQLite defaults them off).
"""

import os
import sqlite3
from pathlib import Path

DB_PATH = os.environ.get("YAHTZEE_DB_PATH", "/data/yahtzee.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    color      TEXT NOT NULL DEFAULT '#4f46e5',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    join_code        TEXT NOT NULL UNIQUE,
    status           TEXT NOT NULL DEFAULT 'active',   -- active | finished
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at      TEXT,
    winner_player_id INTEGER REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS game_players (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id             INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id           INTEGER NOT NULL REFERENCES players(id),
    seat_order          INTEGER NOT NULL,
    yahtzee_bonus_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS scores (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
    category       TEXT NOT NULL,
    value          INTEGER NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(game_player_id, category)
);
"""


def get_db() -> sqlite3.Connection:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    conn = get_db()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
