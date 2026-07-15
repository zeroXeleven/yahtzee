import { useEffect, useState } from 'react'
import { api } from './api'
import type { GameState, GameSummary, Player } from './types'
import { APP_VERSION, PLAYER_COLORS } from './constants'
import GameScreen from './GameScreen'
import HistoryScreen from './HistoryScreen'
import StatsScreen from './StatsScreen'
import SpectatorScreen from './SpectatorScreen'

const PROFILE_KEY = 'yahtzee_profile_id'

type Screen = 'home' | 'history' | 'stats'

export default function App() {
  const [players, setPlayers] = useState<Player[]>([])
  const [profile, setProfile] = useState<Player | null>(null)
  const [game, setGame] = useState<GameState | null>(null)
  const [screen, setScreen] = useState<Screen>('home')
  const [spectate, setSpectate] = useState<string | null>(null)
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

  // Live leaderboard works without a profile — meant for a shared screen.
  if (spectate) {
    return <SpectatorScreen code={spectate} onExit={() => setSpectate(null)} />
  }

  if (!profile) {
    return (
      <ProfileScreen
        players={players}
        onChoose={chooseProfile}
        onSpectate={setSpectate}
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
        onLeave={() => {
          setGame(null)
          setScreen('home')
        }}
      />
    )
  }

  if (screen === 'history') {
    return (
      <HistoryScreen
        onBack={() => setScreen('home')}
        onOpen={(g) => {
          setGame(g)
          setScreen('home')
        }}
      />
    )
  }

  if (screen === 'stats') {
    return <StatsScreen onBack={() => setScreen('home')} />
  }

  return (
    <LobbyScreen
      me={profile}
      players={players}
      onGame={setGame}
      onSignOut={signOut}
      onHistory={() => setScreen('history')}
      onStats={() => setScreen('stats')}
      onSpectate={setSpectate}
    />
  )
}

function ProfileScreen(props: {
  players: Player[]
  onChoose: (p: Player) => void
  onCreated: (p: Player) => void
  onSpectate: (code: string) => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PLAYER_COLORS[0])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [active, setActive] = useState<GameSummary[]>([])

  // All in-progress games — open one as a live leaderboard (no login needed).
  useEffect(() => {
    api
      .listGames('active')
      .then(setActive)
      .catch(() => {})
  }, [])

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
      <h1 className="logo">
        <span className="logo-dice">🎲🎲🎲🎲🎲</span>
        Yahtzee
      </h1>
      <div className="version">{APP_VERSION}</div>

      {active.length > 0 && (
        <div className="card">
          <h2>Active games</h2>
          <p className="muted">Open a live leaderboard — no need to pick a player.</p>
          {active.map((g) => (
            <button
              key={g.join_code}
              className="active-game"
              onClick={() => props.onSpectate(g.join_code)}
            >
              <span className="ag-head">
                <span className="code-badge">
                  <b>{g.join_code}</b>
                </span>
                <span className="ag-players">
                  {g.results.map((r) => (
                    <span key={r.player_id} className="ag-player">
                      <span className="dot" style={{ background: r.color }} />
                      {r.name} {r.grand_total}
                    </span>
                  ))}
                </span>
              </span>
              <span className="ag-rejoin">Leaderboard →</span>
            </button>
          ))}
        </div>
      )}

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
  onHistory: () => void
  onStats: () => void
  onSpectate: (code: string) => void
}) {
  const [code, setCode] = useState('')
  const [selected, setSelected] = useState<number[]>([props.me.id])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [myActive, setMyActive] = useState<GameSummary[]>([])

  // My in-progress games, for one-tap rejoin.
  useEffect(() => {
    api
      .listGames('active')
      .then((games) =>
        setMyActive(games.filter((g) => g.results.some((r) => r.player_id === props.me.id))),
      )
      .catch(() => {})
  }, [props.me.id])

  async function rejoin(joinCode: string) {
    setErr(null)
    try {
      props.onGame(await api.getGame(joinCode))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

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

      {myActive.length > 0 && (
        <div className="card">
          <h2>Your active games</h2>
          {myActive.map((g) => (
            <div key={g.join_code} className="active-game">
              <div className="ag-head">
                <span className="code-badge">
                  <b>{g.join_code}</b>
                </span>
                <span className="ag-players">
                  {g.results.map((r) => (
                    <span key={r.player_id} className="ag-player">
                      <span className="dot" style={{ background: r.color }} />
                      {r.name} {r.grand_total}
                    </span>
                  ))}
                </span>
              </div>
              <div className="ag-actions">
                <button className="link" onClick={() => props.onSpectate(g.join_code)}>
                  board
                </button>
                <button className="ag-rejoin link" onClick={() => rejoin(g.join_code)}>
                  Rejoin →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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

      <div className="nav-row">
        <button className="secondary" onClick={props.onHistory}>
          🗒 History
        </button>
        <button className="secondary" onClick={props.onStats}>
          📊 Stats
        </button>
      </div>

      {err && <p className="inline-error center">{err}</p>}

      <div className="version">{APP_VERSION}</div>
    </div>
  )
}
