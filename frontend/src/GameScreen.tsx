import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { CategoryMeta } from './constants'
import type { GamePlayer, GameState, Player } from './types'
import { CATEGORY_META, LOWER_CATEGORIES, UPPER_CATEGORIES } from './constants'
import Scoreboard from './Scoreboard'

// On the game screen you see and score only your own column. The full grid is
// available on demand via the Leaderboard dialog (and the spectator view).
export default function GameScreen(props: {
  code: string
  me: Player
  initial: GameState
  onLeave: () => void
}) {
  const [game, setGame] = useState<GameState>(props.initial)
  const [editing, setEditing] = useState<string | null>(null) // category key
  const [showBoard, setShowBoard] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setGame(await api.getGame(props.code))
    } catch {
      /* ignore transient fetch errors */
    }
  }, [props.code])

  // Live updates via SSE (auto-reconnects on phone lock); slow poll as fallback.
  useEffect(() => {
    const es = new EventSource(`/api/games/${props.code}/events`)
    es.addEventListener('update', () => void refresh())
    const poll = setInterval(refresh, 15000)
    return () => {
      es.close()
      clearInterval(poll)
    }
  }, [refresh, props.code])

  const finished = game.status === 'finished'
  const me = game.players.find((p) => p.player_id === props.me.id)

  // Returns an error message for the sheet, or null on success.
  async function submitScore(catKey: string, value: number): Promise<string | null> {
    if (!me) return 'you are not a player in this game'
    try {
      setGame(await api.score(props.code, me.game_player_id, catKey, value))
      setEditing(null)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  async function changeBonus(delta: number) {
    if (!me) return
    const next = Math.max(0, me.yahtzee_bonus_count + delta)
    setErr(null)
    try {
      setGame(await api.bonus(props.code, me.game_player_id, next))
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

  const editCat: CategoryMeta | null = editing ? CATEGORY_META[editing] : null

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

      {me ? (
        <div className="you-bar">
          You’re <span className="dot" style={{ background: props.me.color }} />
          <b>{props.me.name}</b>
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

      <button className="secondary board-btn" onClick={() => setShowBoard(true)}>
        📊 Leaderboard
      </button>

      {me ? (
        <MyScorecard
          me={me}
          finished={finished}
          onEdit={(catKey) => setEditing(catKey)}
          onBonus={changeBonus}
        />
      ) : (
        <Scoreboard game={game} meId={props.me.id} />
      )}

      {showBoard && (
        <div className="board-modal-backdrop" onClick={() => setShowBoard(false)}>
          <div className="board-modal" onClick={(e) => e.stopPropagation()}>
            <div className="board-modal-head">
              <b>Leaderboard</b>
              <button className="link" onClick={() => setShowBoard(false)}>
                close
              </button>
            </div>
            <Scoreboard game={game} meId={props.me.id} />
          </div>
        </div>
      )}

      {editing && editCat && me && (
        <ScoreSheet
          playerName={me.name}
          category={editCat}
          current={me.scores[editing]}
          onCancel={() => setEditing(null)}
          onPick={(v) => submitScore(editing, v)}
        />
      )}
    </div>
  )
}

function MyScorecard(props: {
  me: GamePlayer
  finished: boolean
  onEdit: (catKey: string) => void
  onBonus: (delta: number) => void
}) {
  const { me, finished } = props
  const canBonus = me.scores['yahtzee'] === 50 && !finished

  return (
    <div className="my-card">
      <div className="section-label">Upper</div>
      {UPPER_CATEGORIES.map((cat) => (
        <MyRow
          key={cat.key}
          label={cat.label}
          value={me.scores[cat.key]}
          editable={!finished}
          onClick={() => props.onEdit(cat.key)}
        />
      ))}
      <div className="my-sub">
        <span>Upper bonus</span>
        <span className="muted">
          {me.totals.upper_subtotal}/63{me.totals.upper_bonus ? '  +35' : ''}
        </span>
      </div>

      <div className="section-label">Lower</div>
      {LOWER_CATEGORIES.map((cat) => (
        <MyRow
          key={cat.key}
          label={cat.label}
          value={me.scores[cat.key]}
          editable={!finished}
          onClick={() => props.onEdit(cat.key)}
        />
      ))}
      <div className="my-sub">
        <span>Yahtzee bonus (+100)</span>
        {!finished ? (
          <div className="stepper">
            <button disabled={me.yahtzee_bonus_count === 0} onClick={() => props.onBonus(-1)}>
              −
            </button>
            <span>{me.yahtzee_bonus_count}</span>
            <button disabled={!canBonus} onClick={() => props.onBonus(1)}>
              +
            </button>
          </div>
        ) : (
          <span className="muted">{me.yahtzee_bonus_count}</span>
        )}
      </div>

      <div className="my-total">
        <span>Total</span>
        <b>{me.totals.grand_total}</b>
      </div>
    </div>
  )
}

function MyRow(props: {
  label: string
  value: number | undefined
  editable: boolean
  onClick: () => void
}) {
  const filled = props.value !== undefined
  const valCls = (filled ? ' filled' : '') + (props.value === 0 ? ' scratch' : '')
  return (
    <div className="my-row">
      <span className="my-label">{props.label}</span>
      {props.editable ? (
        <button className={'my-val' + valCls} onClick={props.onClick}>
          {filled ? props.value : 'enter'}
        </button>
      ) : (
        <span className={'my-val readonly' + valCls}>{filled ? props.value : '—'}</span>
      )}
    </div>
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

  async function pick(value: number) {
    setErr(null)
    const problem = await props.onPick(value)
    if (problem) setErr(problem)
  }

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
