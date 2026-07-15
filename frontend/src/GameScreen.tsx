import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { CategoryMeta } from './constants'
import type { GameState, GamePlayer, Player } from './types'
import { CATEGORY_META, LOWER_CATEGORIES, UPPER_CATEGORIES } from './constants'

type Editing = { gpId: number; catKey: string } | null

export default function GameScreen(props: {
  code: string
  me: Player
  initial: GameState
  onLeave: () => void
}) {
  const [game, setGame] = useState<GameState>(props.initial)
  const [editing, setEditing] = useState<Editing>(null)
  const [err, setErr] = useState<string | null>(null)

  // Re-fetch shared game state (on a live event, or the safety-net poll).
  const refresh = useCallback(async () => {
    try {
      setGame(await api.getGame(props.code))
    } catch {
      /* ignore transient fetch errors */
    }
  }, [props.code])

  // Live updates via Server-Sent Events. EventSource auto-reconnects when a
  // phone locks/backgrounds, so there's no reconnect logic to maintain. The
  // slow poll is a fallback in case a proxy blocks SSE.
  useEffect(() => {
    const es = new EventSource(`/api/games/${props.code}/events`)
    es.addEventListener('update', () => {
      void refresh()
    })
    const poll = setInterval(refresh, 15000)
    return () => {
      es.close()
      clearInterval(poll)
    }
  }, [refresh, props.code])

  const finished = game.status === 'finished'
  const meInGame = game.players.some((p) => p.player_id === props.me.id)

  // Returns an error message to show in the sheet, or null on success.
  async function submitScore(gpId: number, catKey: string, value: number): Promise<string | null> {
    try {
      setGame(await api.score(props.code, gpId, catKey, value))
      setEditing(null)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  async function changeBonus(p: GamePlayer, delta: number) {
    const next = Math.max(0, p.yahtzee_bonus_count + delta)
    setErr(null)
    try {
      setGame(await api.bonus(props.code, p.game_player_id, next))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  async function endGame() {
    setErr(null)
    try {
      setGame(await api.endGame(props.code))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const winner =
    finished && game.winner_player_id != null
      ? game.players.find((p) => p.player_id === game.winner_player_id)
      : null

  const editCat = editing ? CATEGORY_META[editing.catKey] : null
  const editPlayer = editing ? game.players.find((p) => p.game_player_id === editing.gpId) : null

  return (
    <div className="screen game">
      <div className="topbar">
        <button className="link" onClick={props.onLeave}>
          ← leave
        </button>
        <span className="code-badge">
          code <b>{game.join_code}</b>
        </span>
        {!finished ? (
          <button className="link" onClick={endGame}>
            end game
          </button>
        ) : (
          <span className="muted">finished</span>
        )}
      </div>

      {meInGame ? (
        <div className="you-bar">
          You’re <span className="dot" style={{ background: props.me.color }} />
          <b>{props.me.name}</b>
          <span className="muted"> · you score your own column</span>
        </div>
      ) : (
        <div className="you-bar muted">Viewing — you’re not a player in this game</div>
      )}

      {winner && (
        <div className="winner-banner">
          🏆 {winner.name} wins with {winner.totals.grand_total}!
        </div>
      )}

      {err && <p className="inline-error center">{err}</p>}

      <div className="card-table">
        <table className="scorecard">
          <thead>
            <tr>
              <th className="rowhead corner">Category</th>
              {game.players.map((p) => {
                const isMe = p.player_id === props.me.id
                return (
                  <th key={p.game_player_id} className={'playercol' + (isMe ? ' me' : '')}>
                    <span className="dot" style={{ background: p.color }} />
                    {p.name}
                    {isMe && <span className="you-tag">you</span>}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <SectionLabel span={game.players.length + 1} text="Upper" />
            {UPPER_CATEGORIES.map((cat) => (
              <tr key={cat.key}>
                <td className="rowhead">{cat.label}</td>
                {game.players.map((p) => (
                  <ScoreCell
                    key={p.game_player_id}
                    value={p.scores[cat.key]}
                    editable={p.player_id === props.me.id && !finished}
                    onClick={() => setEditing({ gpId: p.game_player_id, catKey: cat.key })}
                  />
                ))}
              </tr>
            ))}
            <tr className="subtotal">
              <td className="rowhead">Bonus (63+ → 35)</td>
              {game.players.map((p) => (
                <td key={p.game_player_id} className="num muted">
                  {p.totals.upper_subtotal}/63{p.totals.upper_bonus ? ' +35' : ''}
                </td>
              ))}
            </tr>

            <SectionLabel span={game.players.length + 1} text="Lower" />
            {LOWER_CATEGORIES.map((cat) => (
              <tr key={cat.key}>
                <td className="rowhead">{cat.label}</td>
                {game.players.map((p) => (
                  <ScoreCell
                    key={p.game_player_id}
                    value={p.scores[cat.key]}
                    editable={p.player_id === props.me.id && !finished}
                    onClick={() => setEditing({ gpId: p.game_player_id, catKey: cat.key })}
                  />
                ))}
              </tr>
            ))}
            <tr className="subtotal">
              <td className="rowhead">Yahtzee bonus (+100)</td>
              {game.players.map((p) => {
                const isMe = p.player_id === props.me.id
                const canBonus = isMe && p.scores['yahtzee'] === 50 && !finished
                return (
                  <td key={p.game_player_id} className="num">
                    {isMe && !finished ? (
                      <div className="stepper">
                        <button
                          disabled={p.yahtzee_bonus_count === 0}
                          onClick={() => changeBonus(p, -1)}
                        >
                          −
                        </button>
                        <span>{p.yahtzee_bonus_count}</span>
                        <button disabled={!canBonus} onClick={() => changeBonus(p, +1)}>
                          +
                        </button>
                      </div>
                    ) : (
                      <span>{p.yahtzee_bonus_count}</span>
                    )}
                  </td>
                )
              })}
            </tr>

            <tr className="grand">
              <td className="rowhead">Total</td>
              {game.players.map((p) => (
                <td key={p.game_player_id} className="num total">
                  {p.totals.grand_total}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {editing && editCat && editPlayer && (
        <ScoreSheet
          playerName={editPlayer.name}
          category={editCat}
          current={editPlayer.scores[editCat.key]}
          onCancel={() => setEditing(null)}
          onPick={(v) => submitScore(editing.gpId, editing.catKey, v)}
        />
      )}
    </div>
  )
}

function SectionLabel(props: { span: number; text: string }) {
  return (
    <tr className="section">
      <td colSpan={props.span}>{props.text}</td>
    </tr>
  )
}

function ScoreCell(props: {
  value: number | undefined
  editable: boolean
  onClick: () => void
}) {
  const filled = props.value !== undefined
  const cls =
    'cell' + (filled ? ' filled' : '') + (props.value === 0 ? ' scratch' : '')

  if (!props.editable) {
    return (
      <td className="num">
        <span className={cls + ' readonly'}>{filled ? props.value : ''}</span>
      </td>
    )
  }
  return (
    <td className="num">
      <button className={cls} onClick={props.onClick}>
        {filled ? props.value : '+'}
      </button>
    </td>
  )
}

function ScoreSheet(props: {
  playerName: string
  category: CategoryMeta
  current: number | undefined
  onCancel: () => void
  onPick: (value: number) => Promise<string | null>
}) {
  const { category: cat } = props
  const [sumValue, setSumValue] = useState(
    props.current && props.current > 0 ? String(props.current) : '',
  )
  const [err, setErr] = useState<string | null>(null)

  // Submit a value; server errors come back and render inside the sheet.
  async function pick(value: number) {
    setErr(null)
    const problem = await props.onPick(value)
    if (problem) setErr(problem)
  }

  // Sum entry: validate the range client-side for instant, contextual feedback.
  function saveSum() {
    const v = Number(sumValue || 0)
    if (v !== 0 && (v < 5 || v > 30)) {
      setErr(`Must be 0 or 5–30 — you entered ${v}`)
      return
    }
    void pick(v)
  }

  return (
    <div className="sheet-backdrop" onClick={props.onCancel}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>{cat.label}</b>
          <span className="muted">{props.playerName}</span>
        </div>

        {cat.kind === 'upper' && (
          <>
            <p className="muted">How many {cat.label.toLowerCase()}?</p>
            <div className="btn-grid">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button key={n} className="big-btn" onClick={() => pick(n * cat.face!)}>
                  {n}
                  <small>{n * cat.face!} pts</small>
                </button>
              ))}
            </div>
          </>
        )}

        {cat.kind === 'fixed' && (
          <div className="btn-row">
            <button className="big-btn good" onClick={() => pick(cat.fixed!)}>
              Got it
              <small>{cat.fixed} pts</small>
            </button>
            <button className="big-btn bad" onClick={() => pick(0)}>
              Scratch
              <small>0 pts</small>
            </button>
          </div>
        )}

        {cat.kind === 'sum' && (
          <>
            <p className="muted">{cat.hint} (5–30)</p>
            <input
              className="text-input"
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min={0}
              max={30}
              value={sumValue}
              autoFocus
              onChange={(e) => {
                setSumValue(e.target.value)
                if (err) setErr(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  saveSum()
                }
              }}
            />
            <div className="btn-row">
              <button className="big-btn good" onClick={saveSum}>
                Save
              </button>
              <button className="big-btn bad" onClick={() => pick(0)}>
                Scratch
              </button>
            </div>
          </>
        )}

        {err && <p className="sheet-error">{err}</p>}

        <button className="link cancel" onClick={props.onCancel}>
          cancel
        </button>
      </div>
    </div>
  )
}
