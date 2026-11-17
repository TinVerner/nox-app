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

export default function GamesScreen({ me, games, reloadKey = 0, onBook, onCreate, onLogin, onStatus, onKind, onPrice }) {
  const [kindFilter, setKindFilter] = useState('ALL')
  const [pending, setPending] = useState(null)
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const eyebrow = staff ? 'Вечера' : 'Расписание'
  const title = me?.role === 'HOST' ? 'Управление ночами' : me ? 'Запись на вечер' : 'Вечера клуба'
  const visible = kindFilter === 'ALL' ? games : games.filter((game) => game.kind === kindFilter)

  return (
    <section className="screen">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {!me && <p className="lede">Выберите стол, проверьте места и запишитесь. Гостям доступен просмотр; запись — после входа.</p>}
      {staff && (
        <form className="panel stack" onSubmit={onCreate}>
          <h2>Новый вечер</h2>
          <div className="form-row">
            <input name="title" placeholder="название" required />
            <input name="startsAt" type="datetime-local" required />
            <input name="place" placeholder="место" required />
            <input name="seats" type="number" placeholder="мест" required />
            <input name="price" type="number" min="0" placeholder="цена" defaultValue="0" />
            <select name="kind" defaultValue="CLASSIC">
              <option value="CLASSIC">Классика</option>
              <option value="TOURNAMENT">Турнир</option>
              <option value="NOVICE">Новички</option>
            </select>
            <button type="submit">Создать игру</button>
          </div>
        </form>
      )}
      <div className="toolbar">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-current={kindFilter === item.id ? 'page' : undefined}
            onClick={() => setKindFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {pending && (
        <div className="panel stack" style={{ marginBottom: 16 }}>
          <p className="eyebrow">Подтверждение</p>
          <h2 className="night-card__title">{pending.title}</h2>
          <p className="muted">{new Date(pending.startsAt).toLocaleString('ru')}</p>
          <div className="hero-actions">
            <button type="button" className="btn-primary" onClick={() => { onBook(pending.id); setPending(null) }}>Записаться</button>
            <button type="button" className="btn-ghost" onClick={() => setPending(null)}>Отмена</button>
          </div>
        </div>
      )}
      <div className="night-list" key={reloadKey}>
      {visible.map((game) => {
        const when = nightParts(game.startsAt)
        return (
          <article key={game.id} className="night-card">
            <div className="night-card__when">
              <span>{when.label}</span>
              <span className="night-card__time">{when.time}</span>
            </div>
            <div>
              <h2 className="night-card__title">{game.title}</h2>
              <p className="muted">{KIND_LABEL[game.kind] || game.kind} · {game.place} · мест {game.seats}</p>
            </div>
            <div className="night-card__side">
              {game.price > 0 && <span className="price">{game.price} BYN</span>}
              <button type="button" className="btn-primary btn-s" onClick={() => (me ? setPending(game) : onLogin())}>Записаться</button>
            </div>
            {staff && (
              <div className="night-card__tools">
                <span className={game.status === 'PUBLISHED' ? 'status-ok' : 'status-muted'}>{STATUS_LABEL[game.status] || game.status}</span>
                <button type="button" className="btn-secondary btn-s" onClick={() => onStatus(game.id, 'DRAFT')}>Черновик</button>
                <button type="button" className="btn-secondary btn-s" onClick={() => onStatus(game.id, 'PUBLISHED')}>Опубликован</button>
                <button type="button" className="btn-secondary btn-s" onClick={() => onStatus(game.id, 'DONE')}>Завершён</button>
                <select value={game.kind || 'CLASSIC'} onChange={(e) => onKind(game.id, e.target.value)}>
                  <option value="CLASSIC">Классика</option>
                  <option value="TOURNAMENT">Турнир</option>
                  <option value="NOVICE">Новички</option>
                </select>
                <input
                  type="number"
                  min="0"
                  aria-label="цена"
                  defaultValue={game.price ?? 0}
                  onBlur={(e) => {
                    if (String(game.price ?? 0) === e.target.value) return
                    onPrice(game.id, e.target.value)
                  }}
                />
              </div>
            )}
          </article>
        )
      })}
      </div>
    </section>
  )
}
