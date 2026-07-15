import { useEffect, useState } from 'react'
import { api } from './api'
import type { PlayerStats } from './types'

export default function StatsScreen(props: { onBack: () => void }) {
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false))
  }, [])

  const played = stats.filter((s) => s.games_played > 0)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="link" onClick={props.onBack}>
          ← back
        </button>
        <b>Stats</b>
        <span style={{ width: 40 }} />
      </div>

      {err && <p className="inline-error center">{err}</p>}
      {loading && <p className="muted center">Loading…</p>}
      {!loading && played.length === 0 && (
        <p className="muted center">No finished games yet. Stats appear once a game ends.</p>
      )}

      {played.length > 0 && (
        <div className="card-table">
          <table className="scorecard stats-table">
            <thead>
              <tr>
                <th className="rowhead corner">Player</th>
                <th>GP</th>
                <th>W</th>
                <th>Win%</th>
                <th>Avg</th>
                <th>High</th>
                <th>🎲</th>
              </tr>
            </thead>
            <tbody>
              {played.map((s) => (
                <tr key={s.player_id}>
                  <td className="rowhead">
                    <span className="dot" style={{ background: s.color }} /> {s.name}
                  </td>
                  <td className="num">{s.games_played}</td>
                  <td className="num">{s.wins}</td>
                  <td className="num">{s.win_rate}%</td>
                  <td className="num">{s.avg_score}</td>
                  <td className="num total">{s.high_score}</td>
                  <td className="num">{s.total_yahtzees}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted small center legend">
        GP games played · W wins · Avg average score · High best game · 🎲 total Yahtzees
      </p>
    </div>
  )
}
