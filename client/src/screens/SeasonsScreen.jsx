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

  return (
    <section className="screen">
      <h1>Сезоны</h1>
      {(seasons || []).map((season) => (
        <article key={season.id}>
          <h2>{season.name}</h2>
          {season.closed ? (
            <p>закрыт</p>
          ) : (
            <button type="button" onClick={() => closeSeason(season.id)}>Закрыть сезон</button>
          )}
        </article>
      ))}
    </section>
  )
}
