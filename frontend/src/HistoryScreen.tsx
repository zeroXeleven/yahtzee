import { useEffect, useState } from 'react'
import { api } from './api'
import type { GameState, GameSummary } from './types'

export default function HistoryScreen(props: {
  onBack: () => void
  onOpen: (g: GameState) => void
}) {
  const [games, setGames] = useState<GameSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  function load() {
    setLoading(true)
    api
      .listGames('all')
      .then(setGames)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function open(code: string) {
    try {
      props.onOpen(await api.getGame(code))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function del(code: string) {
    try {
      await api.deleteGame(code)
      setConfirming(null)
      setGames((gs) => gs.filter((g) => g.join_code !== code))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="link" onClick={props.onBack}>
          ← back
        </button>
        <b>History</b>
        <span style={{ width: 40 }} />
      </div>

      {err && <p className="inline-error center">{err}</p>}
      {loading && <p className="muted center">Loading…</p>}
      {!loading && games.length === 0 && (
        <p className="muted center">No games yet — go play one!</p>
      )}

      {games.map((g) => (
        <div key={g.join_code} className="card history-card">
          <div className="history-head">
            <span className="code-badge">
              <b>{g.join_code}</b>
            </span>
            <span className={'pill ' + g.status}>{g.status}</span>
            <span className="muted small">{fmtDate(g.finished_at ?? g.created_at)}</span>
          </div>

          <div className="results">
            {g.results.map((r, i) => (
              <div key={r.player_id} className="result-row">
                <span className="rank">{r.is_winner ? '🏆' : `${i + 1}.`}</span>
                <span className="dot" style={{ background: r.color }} />
                <span className="rname">{r.name}</span>
                <span className="rscore">{r.grand_total}</span>
              </div>
            ))}
          </div>

          <div className="history-actions">
            <button className="link" onClick={() => open(g.join_code)}>
              {g.status === 'active' ? 'resume' : 'view'}
            </button>
            {confirming === g.join_code ? (
              <span className="confirm">
                delete?
                <button className="link danger" onClick={() => del(g.join_code)}>
                  yes
                </button>
                <button className="link" onClick={() => setConfirming(null)}>
                  no
                </button>
              </span>
            ) : (
              <button className="link danger" onClick={() => setConfirming(g.join_code)}>
                delete
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function fmtDate(s: string): string {
  // SQLite datetime('now') is UTC without a zone marker; treat it as UTC.
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return s
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
