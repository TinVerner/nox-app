import { useState } from 'react'

const FILTERS = [
  { id: 'ALL', label: 'Все' },
  { id: 'CLASSIC', label: 'Классика' },
  { id: 'TOURNAMENT', label: 'Турнир' },
  { id: 'NOVICE', label: 'Новички' },
]

const STATUS_LABEL = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  DONE: 'Завершён',
}

const KIND_LABEL = {
  CLASSIC: 'Классика',
  TOURNAMENT: 'Турнир',
  NOVICE: 'Новички',
}

export default function GamesScreen({ me, games, reloadKey = 0, onBook, onCreate, onLogin, onStatus, onKind }) {
  const [kindFilter, setKindFilter] = useState('ALL')
  const [pending, setPending] = useState(null)
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const title = me?.role === 'HOST' ? 'Вечера' : 'Расписание'
  const visible = kindFilter === 'ALL' ? games : games.filter((game) => game.kind === kindFilter)

  return (
    <section className="screen">
      <h1>{title}</h1>
      {staff && (
        <form onSubmit={onCreate}>
          <input name="title" placeholder="название" required />
          <input name="startsAt" type="datetime-local" required />
          <input name="place" placeholder="место" required />
          <input name="seats" type="number" placeholder="мест" required />
          <select name="kind" defaultValue="CLASSIC">
            <option value="CLASSIC">Классика</option>
            <option value="TOURNAMENT">Турнир</option>
            <option value="NOVICE">Новички</option>
          </select>
          <button>Создать игру</button>
        </form>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="nav-link"
            aria-current={kindFilter === item.id ? 'page' : undefined}
            onClick={() => setKindFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {pending && (
        <div className="game-row">
          <span className="game-row__date">{new Date(pending.startsAt).toLocaleString('ru')}</span>
          <h2 className="game-row__title">{pending.title}</h2>
          <button type="button" onClick={() => { onBook(pending.id); setPending(null) }}>Записаться</button>
          <button type="button" onClick={() => setPending(null)}>Отмена</button>
        </div>
      )}
      <div key={reloadKey}>
      {visible.map((game) => (
        <article key={game.id} className="game-row">
          <span className="game-row__date">{new Date(game.startsAt).toLocaleString('ru')}</span>
          <h2 className="game-row__title">{game.title}</h2>
          <span>{KIND_LABEL[game.kind] || game.kind}</span>
          <span>{game.place}</span>
          <span>мест: {game.seats}</span>
          <button type="button" onClick={() => (me ? setPending(game) : onLogin())}>Записаться</button>
          {staff && (
            <div className="game-status">
              <span>{STATUS_LABEL[game.status] || game.status}</span>
              <button type="button" onClick={() => onStatus(game.id, 'DRAFT')}>Черновик</button>
              <button type="button" onClick={() => onStatus(game.id, 'PUBLISHED')}>Опубликован</button>
              <button type="button" onClick={() => onStatus(game.id, 'DONE')}>Завершён</button>
              <select value={game.kind || 'CLASSIC'} onChange={(e) => onKind(game.id, e.target.value)}>
                <option value="CLASSIC">Классика</option>
                <option value="TOURNAMENT">Турнир</option>
                <option value="NOVICE">Новички</option>
              </select>
            </div>
          )}
        </article>
      ))}
      </div>
    </section>
  )
}
