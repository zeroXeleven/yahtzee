import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { GameState } from './types'
import Scoreboard from './Scoreboard'

// Full live leaderboard for a game, no profile required — meant to sit on a
// shared screen (iPad on the table). Updates over SSE like the game screen.
export default function SpectatorScreen(props: { code: string; onExit: () => void }) {
  const [game, setGame] = useState<GameState | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setGame(await api.getGame(props.code))
    } catch (e) {
      setErr((e as Error).message)
    }
  }, [props.code])

  useEffect(() => {
    void refresh()
    const es = new EventSource(`/api/games/${props.code}/events`)
    es.addEventListener('update', () => void refresh())
    const poll = setInterval(refresh, 15000)
    return () => {
      es.close()
      clearInterval(poll)
    }
  }, [refresh, props.code])

  const winner =
    game && game.status === 'finished' && game.winner_player_id != null
      ? game.players.find((p) => p.player_id === game.winner_player_id)
      : null

  return (
    <div className="screen">
      <div className="topbar">
        <button className="link" onClick={props.onExit}>
          ← back
        </button>
        <span className="code-badge">
          code <b>{props.code}</b>
        </span>
        <span className="muted">● live</span>
      </div>

      {err && <p className="inline-error center">{err}</p>}

      {winner && (
        <div className="winner-banner">
          🏆 {winner.name} wins with {winner.totals.grand_total}!
        </div>
      )}

      {game && <Scoreboard game={game} />}
    </div>
  )
}
