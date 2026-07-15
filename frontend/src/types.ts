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
