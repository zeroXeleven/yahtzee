import { useEffect, useState } from 'react'
import { api } from './api'
import type { GameState, Player } from './types'
import { PLAYER_COLORS } from './constants'
import GameScreen from './GameScreen'

const PROFILE_KEY = 'yahtzee_profile_id'

export default function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [profile, setProfile] = useState<Player | null>(null)
  const [game, setGame] = useState<GameState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load profiles once; restore the last-used profile on this device.
  useEffect(() => {
    api
      .listPlayers()
      .then((ps) => {
        setPlayers(ps)
        const savedId = Number(localStorage.getItem(PROFILE_KEY))
        const saved = ps.find((p) => p.id === savedId)
        if (saved) setProfile(saved)
      })
      .catch((e) => setError(e.message))
  }, [])

  function chooseProfile(p: Player) {
    localStorage.setItem(PROFILE_KEY, String(p.id))
    setProfile(p)
  }

  function signOut() {
    localStorage.removeItem(PROFILE_KEY)
    setProfile(null)
    setGame(null)
  }

  if (error) {
    return (
      <div className="screen">
        <div className="card error-card">
          <p>Something went wrong:</p>
          <code>{error}</code>
          <button onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <ProfileScreen
        players={players}
        onChoose={chooseProfile}
        onCreated={(p) => {
          setPlayers((prev) => [...prev, p].sort((a, b) => a.name.localeCompare(b.name)))
          chooseProfile(p)
        }}
      />
    )
  }

  if (game) {
    return (
      <GameScreen
        code={game.join_code}
        me={profile}
        initial={game}
        onLeave={() => setGame(null)}
      />
    )
  }

  return (
    <LobbyScreen
      me={profile}
      players={players}
      onGame={setGame}
      onSignOut={signOut}
    />
  )
}

function ProfileScreen(props: {
  players: Player[]
  onChoose: (p: Player) => void
  onCreated: (p: Player) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PLAYER_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      props.onCreated(await api.createPlayer(name.trim(), color))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <h1 className="logo">🎲 Yahtzee</h1>
      <div className="card">
        <h2>Who's playing?</h2>
        {props.players.length > 0 && (
          <div className="profile-grid">
            {props.players.map((p) => (
              <button
                key={p.id}
                className="profile-chip"
                style={{ borderColor: p.color }}
                onClick={() => props.onChoose(p)}
              >
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </button>
            ))}
          </div>
        )}

        <div className="divider">or add someone new</div>

        <input
          className="text-input"
          placeholder="Name"
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <div className="color-row">
          {PLAYER_COLORS.map((c) => (
            <button
              key={c}
              className={'swatch' + (c === color ? ' selected' : '')}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={`color ${c}`}
            />
          ))}
        </div>
        {err && <p className="inline-error">{err}</p>}
        <button className="primary" disabled={busy || !name.trim()} onClick={create}>
          Add player
        </button>
      </div>
    </div>
  )
}

function LobbyScreen(props: {
  me: Player
  players: Player[]
  onGame: (g: GameState) => void
  onSignOut: () => void
}) {
  const [code, setCode] = useState('')
  const [selected, setSelected] = useState<number[]>([props.me.id])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function newGame() {
    setBusy(true)
    setErr(null)
    try {
      // Put "me" first so I'm seat 0.
      const ordered = [props.me.id, ...selected.filter((id) => id !== props.me.id)]
      props.onGame(await api.createGame(ordered))
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function joinGame() {
    const c = code.trim().toUpperCase()
    if (!c) return
    setBusy(true)
    setErr(null)
    try {
      // Join adds me if I'm not already in it; either way, load state.
      try {
        props.onGame(await api.joinGame(c, props.me.id))
      } catch (e) {
        if ((e as Error).message.includes('already in this game')) {
          props.onGame(await api.getGame(c))
        } else {
          throw e
        }
      }
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <span>
          <span className="dot" style={{ background: props.me.color }} /> {props.me.name}
        </span>
        <button className="link" onClick={props.onSignOut}>
          switch
        </button>
      </div>

      <div className="card">
        <h2>New game</h2>
        <p className="muted">Pick who's at the table (others can join by code too):</p>
        <div className="profile-grid">
          {props.players.map((p) => (
            <button
              key={p.id}
              className={'profile-chip' + (selected.includes(p.id) ? ' on' : '')}
              style={{ borderColor: p.color }}
              onClick={() => toggle(p.id)}
            >
              <span className="dot" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
        <button className="primary" disabled={busy || selected.length === 0} onClick={newGame}>
          Start game
        </button>
      </div>

      <div className="card">
        <h2>Join a game</h2>
        <input
          className="text-input code-input"
          placeholder="CODE"
          value={code}
          maxLength={4}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && joinGame()}
        />
        <button className="secondary" disabled={busy || code.trim().length < 4} onClick={joinGame}>
          Join
        </button>
      </div>

      {err && <p className="inline-error center">{err}</p>}
    </div>
  )
}
