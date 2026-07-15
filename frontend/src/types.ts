export interface Player {
  id: number
  name: string
  color: string
}

export interface Totals {
  upper_subtotal: number
  upper_bonus: number
  upper_total: number
  lower_subtotal: number
  yahtzee_bonus_count: number
  yahtzee_bonus_total: number
  grand_total: number
}

export interface GamePlayer {
  game_player_id: number
  player_id: number
  name: string
  color: string
  seat_order: number
  scores: Record<string, number>
  yahtzee_bonus_count: number
  totals: Totals
  complete: boolean
}

export interface GameState {
  join_code: string
  status: 'active' | 'finished'
  winner_player_id: number | null
  categories: string[]
  players: GamePlayer[]
}

export interface GameResult {
  player_id: number
  name: string
  color: string
  grand_total: number
  is_winner: boolean
}

export interface GameSummary {
  join_code: string
  status: 'active' | 'finished'
  created_at: string
  finished_at: string | null
  winner_player_id: number | null
  results: GameResult[]
}

export interface PlayerStats {
  player_id: number
  name: string
  color: string
  games_played: number
  wins: number
  win_rate: number
  high_score: number
  avg_score: number
  total_yahtzees: number
}
