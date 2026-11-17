import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { rankLabel } from '../ranks'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function ProfileScreen({ me }) {
  const [rating, setRating] = useState(null)
  const [account, setAccount] = useState(null)

  useEffect(() => {
    apiFetch('/api/rating')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRating)
      .catch(() => setRating([]))
    apiFetch('/api/me')
      .then((response) => (response.ok ? response.json() : null))
      .then(setAccount)
      .catch(() => setAccount(null))
  }, [])

  const row = (rating || []).find((item) => item.nick === me?.nick)

  return (
    <section className="screen">
      <p className="eyebrow">Профиль</p>
      <h1>{me?.nick}</h1>
      <p className="lede">{ROLE[me?.role] || me?.role}{rankLabel(account?.rank) ? ` · ${rankLabel(account.rank)}` : ''}</p>
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
          <article className="panel">
            <p className="eyebrow">Бонусы</p>
            <p className="stat-value">{account ? account.bonus : '—'}</p>
          </article>
          {!row && <p className="muted">в рейтинге нет</p>}
        </div>
      )}
    </section>
  )
}
