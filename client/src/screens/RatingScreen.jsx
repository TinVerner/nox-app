import { useState } from 'react'

export default function RatingScreen({ rating }) {
  const [open, setOpen] = useState(false)
  const top = rating.slice(0, 3)
  const rest = rating.slice(3)

  return (
    <section className="screen">
      <p className="eyebrow">Рейтинг</p>
      <div className="page-head">
        <h1>Таблица клуба</h1>
        <button type="button" className="btn-ghost btn-s" onClick={() => setOpen(true)}>Как считается</button>
      </div>
      {open && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <p>Очки игрока — сумма очков, которые ведущий внёс в результатах вечеров. Число игр — сколько таких результатов есть у ника. Пока результатов нет, показан прежний список.</p>
          <button type="button" className="btn-secondary btn-s" onClick={() => setOpen(false)}>Закрыть</button>
        </div>
      )}
      <div className="podium">
        {top.map((row, index) => (
          <article key={row.id} className={`podium-card podium-card--${index + 1}`}>
            <p className="podium-place">{index + 1}</p>
            <h2 className="podium-nick">{row.nick}</h2>
            <p className="muted">{row.points} очков · игр {row.games}</p>
          </article>
        ))}
      </div>
      <div className="rating-rows">
        {rest.map((row, index) => (
          <article key={row.id} className="rating-row">
            <span className="muted">{index + 4}</span>
            <span>{row.nick}</span>
            <span>{row.points} очков</span>
            <span className="muted">игр {row.games}</span>
          </article>
        ))}
      </div>
    </section>
  )
}
