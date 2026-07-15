import type { GameState } from './types'
import { LOWER_CATEGORIES, UPPER_CATEGORIES } from './constants'

// Read-only full grid of every player's scores. Used in the in-game leaderboard
// dialog and the standalone spectator view.
export default function Scoreboard(props: { game: GameState; meId?: number }) {
  const { game } = props
  const span = game.players.length + 1

  return (
    <div className="card-table">
      <table className="scorecard">
        <thead>
          <tr>
            <th className="rowhead corner">Category</th>
            {game.players.map((p) => (
              <th
                key={p.game_player_id}
                className={'playercol' + (p.player_id === props.meId ? ' me' : '')}
              >
                <span className="dot" style={{ background: p.color }} />
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="section">
            <td colSpan={span}>Upper</td>
          </tr>
          {UPPER_CATEGORIES.map((cat) => (
            <tr key={cat.key}>
              <td className="rowhead">{cat.label}</td>
              {game.players.map((p) => (
                <ReadCell key={p.game_player_id} v={p.scores[cat.key]} />
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

          <tr className="section">
            <td colSpan={span}>Lower</td>
          </tr>
          {LOWER_CATEGORIES.map((cat) => (
            <tr key={cat.key}>
              <td className="rowhead">{cat.label}</td>
              {game.players.map((p) => (
                <ReadCell key={p.game_player_id} v={p.scores[cat.key]} />
              ))}
            </tr>
          ))}
          <tr className="subtotal">
            <td className="rowhead">Yahtzee bonus (+100)</td>
            {game.players.map((p) => (
              <td key={p.game_player_id} className="num muted">
                {p.yahtzee_bonus_count}
              </td>
            ))}
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
  )
}

function ReadCell({ v }: { v: number | undefined }) {
  const filled = v !== undefined
  return (
    <td className="num">
      <span className={'cell readonly' + (filled ? ' filled' : '') + (v === 0 ? ' scratch' : '')}>
        {filled ? v : ''}
      </span>
    </td>
  )
}
