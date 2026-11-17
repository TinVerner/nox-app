import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function ProfileScreen({ me }) {
  const [rating, setRating] = useState(null)

  useEffect(() => {
    apiFetch('/api/rating')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRating)
      .catch(() => setRating([]))
  }, [])

  const row = (rating || []).find((item) => item.nick === me?.nick)

  return (
    <section className="screen">
      <p className="eyebrow">Профиль</p>
      <h1>{me?.nick}</h1>
      <p className="lede">{ROLE[me?.role] || me?.role}</p>
      {rating === null ? null : (
        <div className="stat-grid">
          <article className="panel">
            <p className="eyebrow">Очки</p>
            <p className="stat-value">{row ? row.points : '—'}</p>
          </article>
          <article className="panel">
            <p className="eyebrow">Игры</p>
            <p className="stat-value">{row ? row.games : '—'}</p>
          </article>
          {!row && <p className="muted">в рейтинге нет</p>}
        </div>
      )}
    </section>
  )
}
