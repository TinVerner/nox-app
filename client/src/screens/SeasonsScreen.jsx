import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function SeasonsScreen() {
  const [seasons, setSeasons] = useState(null)

  useEffect(() => {
    apiFetch('/api/seasons')
      .then((r) => (r.ok ? r.json() : []))
      .then(setSeasons)
      .catch(() => setSeasons([]))
  }, [])

  async function closeSeason(id) {
    const res = await apiFetch('/api/seasons/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    })
    if (!res.ok) return alert('не вышло')
    const updated = await res.json()
    setSeasons((rows) => rows.map((season) => (season.id === id ? updated : season)))
  }

  const open = (seasons || []).filter((season) => !season.closed)
  const closed = (seasons || []).filter((season) => season.closed)

  return (
    <section className="screen">
      <p className="eyebrow">Сезоны</p>
      <h1>Сезоны клуба</h1>
      <p className="lede">Текущий сезон и архив. Закрытие прячет вечера сезона из открытого расписания.</p>
      <div className="stack">
        {open.map((season) => (
          <article key={season.id} className="panel">
            <p className="eyebrow">Текущий сезон</p>
            <h2>{season.name}</h2>
            <button type="button" className="btn-danger btn-s" onClick={() => closeSeason(season.id)}>Закрыть сезон</button>
          </article>
        ))}
        {closed.length > 0 && (
          <div className="panel">
            <h2>Архив сезонов</h2>
            {closed.map((season) => (
              <p key={season.id}>{season.name} · закрыт</p>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
