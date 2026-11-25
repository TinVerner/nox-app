import { useState } from 'react'

function formatWinRate(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`
}

function RoleWinLine({ byRole }) {
  if (!byRole?.length) return <span className="muted">нет партий с ролями</span>
  return (
    <span className="rating-roles">
      {byRole.map((row) => (
        <span key={row.role} className="rating-role-chip">
          {row.label} {formatWinRate(row.winRate)}
          <span className="muted"> ({row.wins}/{row.games})</span>
        </span>
      ))}
    </span>
  )
}

export default function RatingScreen({ rating }) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState({})
  const listed = rating.filter((row) => Number(row.points) !== 0)
  const top = listed.slice(0, 3)
  const rest = listed.slice(3)

  function toggle(id) {
    setExpanded((map) => ({ ...map, [id]: !map[id] }))
  }

  return (
    <section className="screen">
      <p className="eyebrow">Рейтинг</p>
      <div className="page-head">
        <h1>Топ клуба</h1>
        <button type="button" className="btn-ghost btn-s" onClick={() => setOpen(true)}>Как считается</button>
      </div>
      {open && (
        <div className="panel stack explain">
          <p>
            Очки игрока — сумма очков из опубликованных результатов вечеров. Число игр — сколько таких партий
            (пропуски SKIPPED не считаются). Win% — доля побед по стороне роли: мирные и шериф выигрывают с городом,
            мафия и дон — с мафией. В таблице — win% по ролям.
          </p>
          <button type="button" className="btn-secondary btn-s" onClick={() => setOpen(false)}>Закрыть</button>
        </div>
      )}
      {listed.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <>
          <div className="podium">
            {top.map((row, index) => (
              <article key={row.id} className={`podium-card podium-card--${index + 1}`}>
                <p className="podium-place">{index + 1}</p>
                <h2 className="podium-nick">{row.nick}</h2>
                <p className="muted">{row.points} очков · игр {row.games}</p>
                <p className="rating-win">{formatWinRate(row.winRate)} побед</p>
                <button type="button" className="btn-ghost btn-s" onClick={() => toggle(row.id)}>
                  {expanded[row.id] ? 'Скрыть роли' : 'По ролям'}
                </button>
                {expanded[row.id] ? <RoleWinLine byRole={row.byRole} /> : null}
              </article>
            ))}
          </div>
          {rest.length > 0 && (
            <div className="rating-rows">
              {rest.map((row, index) => (
                <article key={row.id} className="rating-row">
                  <span className="muted">{index + 4}</span>
                  <span className="rating-nick">
                    <span>{row.nick}</span>
                    {expanded[row.id] ? <RoleWinLine byRole={row.byRole} /> : null}
                  </span>
                  <span className="rating-meta">
                    <span>{row.points} очков</span>
                    <span className="muted">игр {row.games}</span>
                    <span className="rating-win">{formatWinRate(row.winRate)}</span>
                    <button type="button" className="btn-ghost btn-s" onClick={() => toggle(row.id)}>
                      {expanded[row.id] ? '−' : '+'}
                    </button>
                  </span>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
