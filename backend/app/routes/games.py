"""Games — start, join by code, enter scores, claim Yahtzee bonuses, finish.

The full game state (players, scores, live totals) is returned from most
endpoints and polled by clients for the shared-scoreboard experience.
"""

import random
import sqlite3

from fastapi import APIRouter, HTTPException

from ..db import get_db
from ..models import BonusEntry, GameCreate, JoinGame, ScoreEntry
from ..scoring import (
    ALL_CATEGORIES,
    Category,
    ScoreError,
    compute_totals,
    validate,
    validate_yahtzee_bonus,
)

router = APIRouter(tags=["games"])

# Unambiguous alphabet: no 0/O, 1/I, etc.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _gen_code(conn: sqlite3.Connection) -> str:
    for _ in range(25):
        code = "".join(random.choice(_CODE_ALPHABET) for _ in range(4))
        if not conn.execute(
            "SELECT 1 FROM games WHERE join_code = ?", (code,)
        ).fetchone():
            return code
    raise HTTPException(500, "could not generate a unique game code")


def _require_active_game_player(conn, code: str, game_player_id: int) -> None:
    row = conn.execute(
        """SELECT gp.id FROM game_players gp
             JOIN games g ON g.id = gp.game_id
            WHERE gp.id = ? AND g.join_code = ? AND g.status = 'active'""",
        (game_player_id, code),
    ).fetchone()
    if not row:
        raise HTTPException(404, "player is not part of this active game")


def _game_state(code: str) -> dict:
    conn = get_db()
    try:
        game = conn.execute(
            "SELECT * FROM games WHERE join_code = ?", (code,)
        ).fetchone()
        if not game:
            raise HTTPException(404, "game not found")

        seats = conn.execute(
            """SELECT gp.id AS gp_id, gp.player_id, gp.seat_order,
                      gp.yahtzee_bonus_count, p.name, p.color
                 FROM game_players gp
                 JOIN players p ON p.id = gp.player_id
                WHERE gp.game_id = ?
                ORDER BY gp.seat_order""",
            (game["id"],),
        ).fetchall()

        players = []
        for s in seats:
            rows = conn.execute(
                "SELECT category, value FROM scores WHERE game_player_id = ?",
                (s["gp_id"],),
            ).fetchall()
            scores = {r["category"]: r["value"] for r in rows}
            players.append({
                "game_player_id": s["gp_id"],
                "player_id": s["player_id"],
                "name": s["name"],
                "color": s["color"],
                "seat_order": s["seat_order"],
                "scores": scores,
                "yahtzee_bonus_count": s["yahtzee_bonus_count"],
                "totals": compute_totals(scores, s["yahtzee_bonus_count"]),
                "complete": len(scores) == len(ALL_CATEGORIES),
            })

        return {
            "join_code": game["join_code"],
            "status": game["status"],
            "winner_player_id": game["winner_player_id"],
            "categories": [c.value for c in ALL_CATEGORIES],
            "players": players,
        }
    finally:
        conn.close()


@router.post("/games", status_code=201)
def create_game(body: GameCreate):
    conn = get_db()
    try:
        code = _gen_code(conn)
        cur = conn.execute("INSERT INTO games (join_code) VALUES (?)", (code,))
        game_id = cur.lastrowid
        for seat, pid in enumerate(body.player_ids):
            conn.execute(
                "INSERT INTO game_players (game_id, player_id, seat_order) "
                "VALUES (?, ?, ?)",
                (game_id, pid, seat),
            )
        conn.commit()
    except sqlite3.IntegrityError as e:
        raise HTTPException(400, f"could not create game: {e}")
    finally:
        conn.close()
    return _game_state(code)


@router.get("/games/{code}")
def get_game(code: str):
    return _game_state(code)


@router.post("/games/{code}/join", status_code=201)
def join_game(code: str, body: JoinGame):
    conn = get_db()
    try:
        game = conn.execute(
            "SELECT * FROM games WHERE join_code = ?", (code,)
        ).fetchone()
        if not game:
            raise HTTPException(404, "game not found")
        if game["status"] != "active":
            raise HTTPException(409, "this game has already finished")
        seat = conn.execute(
            "SELECT COUNT(*) AS n FROM game_players WHERE game_id = ?",
            (game["id"],),
        ).fetchone()["n"]
        try:
            conn.execute(
                "INSERT INTO game_players (game_id, player_id, seat_order) "
                "VALUES (?, ?, ?)",
                (game["id"], body.player_id, seat),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(409, "that player is already in this game")
    finally:
        conn.close()
    return _game_state(code)


@router.post("/games/{code}/score")
def enter_score(code: str, body: ScoreEntry):
    try:
        category = Category(body.category)
    except ValueError:
        raise HTTPException(400, f"unknown category: {body.category}")
    try:
        validate(category, body.value)
    except ScoreError as e:
        raise HTTPException(400, str(e))

    conn = get_db()
    try:
        _require_active_game_player(conn, code, body.game_player_id)
        conn.execute(
            """INSERT INTO scores (game_player_id, category, value)
                    VALUES (?, ?, ?)
               ON CONFLICT(game_player_id, category)
                    DO UPDATE SET value = excluded.value""",
            (body.game_player_id, category.value, body.value),
        )
        conn.commit()
    finally:
        conn.close()
    return _game_state(code)


@router.post("/games/{code}/bonus")
def set_bonus(code: str, body: BonusEntry):
    conn = get_db()
    try:
        _require_active_game_player(conn, code, body.game_player_id)
        yz = conn.execute(
            "SELECT value FROM scores WHERE game_player_id = ? AND category = ?",
            (body.game_player_id, Category.YAHTZEE.value),
        ).fetchone()
        try:
            validate_yahtzee_bonus(body.bonus_count, yz["value"] if yz else None)
        except ScoreError as e:
            raise HTTPException(400, str(e))
        conn.execute(
            "UPDATE game_players SET yahtzee_bonus_count = ? WHERE id = ?",
            (body.bonus_count, body.game_player_id),
        )
        conn.commit()
    finally:
        conn.close()
    return _game_state(code)


@router.post("/games/{code}/end")
def end_game(code: str):
    state = _game_state(code)  # raises 404 if the game is missing

    winner_id = None
    best = -1
    for p in state["players"]:
        if p["totals"]["grand_total"] > best:
            best = p["totals"]["grand_total"]
            winner_id = p["player_id"]

    conn = get_db()
    try:
        conn.execute(
            """UPDATE games
                  SET status = 'finished',
                      finished_at = datetime('now'),
                      winner_player_id = ?
                WHERE join_code = ?""",
            (winner_id, code),
        )
        conn.commit()
    finally:
        conn.close()
    return _game_state(code)
