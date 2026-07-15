"""Per-player stats aggregated across *finished* games.

Only finished games count, so abandoned or in-progress games never skew the
numbers. Grand totals aren't stored — they're recomputed from scores via the
scoring engine, the single source of truth.
"""

from fastapi import APIRouter

from ..db import get_db
from ..scoring import Category, compute_totals

router = APIRouter(tags=["stats"])


@router.get("/stats")
def player_stats():
    conn = get_db()
    try:
        players = conn.execute("SELECT id, name, color FROM players").fetchall()
        stats = {
            p["id"]: {
                "player_id": p["id"],
                "name": p["name"],
                "color": p["color"],
                "games_played": 0,
                "wins": 0,
                "high_score": 0,
                "total_yahtzees": 0,
                "_total_score": 0,
            }
            for p in players
        }

        seats = conn.execute(
            """SELECT gp.id AS gp_id, gp.player_id, gp.yahtzee_bonus_count,
                      g.winner_player_id
                 FROM game_players gp
                 JOIN games g ON g.id = gp.game_id
                WHERE g.status = 'finished'"""
        ).fetchall()

        for s in seats:
            st = stats.get(s["player_id"])
            if not st:
                continue
            rows = conn.execute(
                "SELECT category, value FROM scores WHERE game_player_id = ?",
                (s["gp_id"],),
            ).fetchall()
            scores = {r["category"]: r["value"] for r in rows}
            grand = compute_totals(scores, s["yahtzee_bonus_count"])["grand_total"]

            st["games_played"] += 1
            st["_total_score"] += grand
            st["high_score"] = max(st["high_score"], grand)
            if s["winner_player_id"] == s["player_id"]:
                st["wins"] += 1
            first_yahtzee = 1 if scores.get(Category.YAHTZEE.value) == 50 else 0
            st["total_yahtzees"] += first_yahtzee + s["yahtzee_bonus_count"]

        out = []
        for st in stats.values():
            played = st["games_played"]
            total_score = st.pop("_total_score")  # always drop the internal field
            st["avg_score"] = round(total_score / played, 1) if played else 0
            st["win_rate"] = round(100 * st["wins"] / played) if played else 0
            out.append(st)

        # Players who've actually played first, ranked by wins then average.
        out.sort(
            key=lambda s: (s["games_played"] > 0, s["wins"], s["avg_score"]),
            reverse=True,
        )
        return out
    finally:
        conn.close()
