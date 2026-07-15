// UI metadata for each scoring category. `kind` drives which entry control the
// scorecard renders:
//   upper -> 0-5 stepper (value = count * face)
//   fixed -> got-it / scratch toggle (value is 0 or `fixed`)
//   sum   -> numeric entry (0, or a dice total 5-30)

export type CategoryKind = 'upper' | 'fixed' | 'sum'

export interface CategoryMeta {
  key: string
  label: string
  kind: CategoryKind
  face?: number
  fixed?: number
  hint?: string
}

export const UPPER_CATEGORIES: CategoryMeta[] = [
  { key: 'ones', label: 'Ones', kind: 'upper', face: 1 },
  { key: 'twos', label: 'Twos', kind: 'upper', face: 2 },
  { key: 'threes', label: 'Threes', kind: 'upper', face: 3 },
  { key: 'fours', label: 'Fours', kind: 'upper', face: 4 },
  { key: 'fives', label: 'Fives', kind: 'upper', face: 5 },
  { key: 'sixes', label: 'Sixes', kind: 'upper', face: 6 },
]

export const LOWER_CATEGORIES: CategoryMeta[] = [
  { key: 'three_of_a_kind', label: 'Three of a Kind', kind: 'sum', hint: 'sum of all dice' },
  { key: 'four_of_a_kind', label: 'Four of a Kind', kind: 'sum', hint: 'sum of all dice' },
  { key: 'full_house', label: 'Full House', kind: 'fixed', fixed: 25 },
  { key: 'small_straight', label: 'Small Straight', kind: 'fixed', fixed: 30 },
  { key: 'large_straight', label: 'Large Straight', kind: 'fixed', fixed: 40 },
  { key: 'yahtzee', label: 'Yahtzee', kind: 'fixed', fixed: 50 },
  { key: 'chance', label: 'Chance', kind: 'sum', hint: 'sum of all dice' },
]

export const ALL_CATEGORIES = [...UPPER_CATEGORIES, ...LOWER_CATEGORIES]

export const CATEGORY_META: Record<string, CategoryMeta> = Object.fromEntries(
  ALL_CATEGORIES.map((c) => [c.key, c]),
)

export const PLAYER_COLORS = [
  '#e11d48', '#2563eb', '#16a34a', '#d97706',
  '#7c3aed', '#0891b2', '#db2777', '#4b5563',
]
