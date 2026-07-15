import type { GameState, Player } from './types'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail ?? detail
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const api = {
  listPlayers: () => req<Player[]>('/players'),

  createPlayer: (name: string, color: string) =>
    req<Player>('/players', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),

  createGame: (playerIds: number[]) =>
    req<GameState>('/games', {
      method: 'POST',
      body: JSON.stringify({ player_ids: playerIds }),
    }),

  getGame: (code: string) => req<GameState>(`/games/${code}`),

  joinGame: (code: string, playerId: number) =>
    req<GameState>(`/games/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ player_id: playerId }),
    }),

  score: (code: string, gamePlayerId: number, category: string, value: number) =>
    req<GameState>(`/games/${code}/score`, {
      method: 'POST',
      body: JSON.stringify({ game_player_id: gamePlayerId, category, value }),
    }),

  bonus: (code: string, gamePlayerId: number, bonusCount: number) =>
    req<GameState>(`/games/${code}/bonus`, {
      method: 'POST',
      body: JSON.stringify({ game_player_id: gamePlayerId, bonus_count: bonusCount }),
    }),

  endGame: (code: string) =>
    req<GameState>(`/games/${code}/end`, { method: 'POST' }),
}
