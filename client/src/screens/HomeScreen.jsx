import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const KIND_LABEL = {
  CLASSIC: 'Классика',
  TOURNAMENT: 'Турнир',
  NOVICE: 'Новички',
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
    <section className="screen">
      <h1 className="hero-title">NOX</h1>
      <p className="hero-line">Клуб интеллектуальной игры «Мафия»</p>

      <h2>Ближайшие игры</h2>
      {games === null ? null : next.length === 0 ? (
        <p>Пока нет игр</p>
      ) : (
        next.map((game) => (
          <article key={game.id} className="game-row">
            <span className="game-row__date">{new Date(game.startsAt).toLocaleString('ru')}</span>
            <h3 className="game-row__title">{game.title}</h3>
            <span>{KIND_LABEL[game.kind] || game.kind}</span>
            <span>{game.place}</span>
            <span>мест: {game.seats}</span>
          </article>
        ))
      )}
      <button className="screen-action" onClick={onOpenSchedule}>Расписание</button>
    </section>
  )
}
