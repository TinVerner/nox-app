import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const KIND_LABEL = {
  CLASSIC: 'Классика',
  TOURNAMENT: 'Турнир',
  NOVICE: 'Новички',
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

function nightParts(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return { label: '', time: '' }
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return {
    label: `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`,
    time,
  }
}

export default function HomeScreen({ onOpenSchedule, reloadKey = 0 }) {
  const [games, setGames] = useState(null)

  useEffect(() => {
    apiFetch('/api/games')
      .then((r) => (r.ok ? r.json() : []))
      .then(setGames)
      .catch(() => setGames([]))
  }, [reloadKey])

  const next = (games || []).filter((game) => new Date(game.startsAt).getTime() >= Date.now())

  return (
    <section className="screen screen--home">
      <div className="hero">
        <h1 className="hero-title">NOX</h1>
        <p className="hero-lead">Клуб спортивной мафии. Вечера за одним столом.</p>
        <p className="lede">Запись на вечера, рейтинг сезона и новости клуба — в одном месте.</p>
        <div className="hero-actions">
          <button type="button" className="btn-primary" onClick={onOpenSchedule}>Записаться</button>
          <a className="btn btn-secondary" href="#upcoming">Подробнее</a>
        </div>
      </div>
      <div className="screen-block" id="upcoming">
        <p className="eyebrow">Ближайшие вечера</p>
        <h2 className="page-title">Расписание</h2>
        {games === null ? null : next.length === 0 ? (
          <p className="muted">Пока нет игр</p>
        ) : (
          <div className="night-list">
            {next.map((game) => {
              const when = nightParts(game.startsAt)
              return (
                <article key={game.id} className="night-card">
                  <div className="night-card__when">
                    <span>{when.label}</span>
                    <span className="night-card__time">{when.time}</span>
                  </div>
                  <div>
                    <h3 className="night-card__title">{game.title}</h3>
                    <p className="muted">{KIND_LABEL[game.kind] || game.kind} · {game.place} · мест {game.seats}</p>
                  </div>
                  <div className="night-card__side">
                    {game.price > 0 ? <span className="price">{game.price} BYN</span> : <span />}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
