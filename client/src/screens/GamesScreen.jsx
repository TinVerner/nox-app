import { useState } from 'react'
import Modal from '../components/Modal'

const FILTERS = [
  { id: 'ALL', label: 'Все' },
  { id: 'CLASSIC', label: 'Классика' },
  { id: 'TOURNAMENT', label: 'Турнир' },
  { id: 'NOVICE', label: 'Новички' },
]

const WEEKS = [
  { id: 'WEEK', label: 'Эта неделя' },
  { id: 'ALL', label: 'Все' },
]

const MINSK_WEEKDAY = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

function minskWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Minsk',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type) => parts.find((part) => part.type === type).value
  const monday = new Date(Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day'))))
  monday.setUTCDate(monday.getUTCDate() - MINSK_WEEKDAY[value('weekday')])
  const start = monday.getTime() - 3 * 60 * 60 * 1000
  return { start, end: start + 7 * 24 * 60 * 60 * 1000 }
}

function inMinskWeek(iso, range) {
  const time = new Date(iso).getTime()
  return time >= range.start && time < range.end
}

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

function toLocalInput(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function GameModal({ game, onClose, onSave }) {
  const [title, setTitle] = useState(game?.title || '')
  const [startsAt, setStartsAt] = useState(game ? toLocalInput(game.startsAt) : '')
  const [place, setPlace] = useState(game?.place || '')
  const [seats, setSeats] = useState(game?.seats ?? '')
  const [kind, setKind] = useState(game?.kind || 'CLASSIC')
  const [price, setPrice] = useState(game?.price ?? 0)
  const [status, setStatus] = useState(game?.status || 'PUBLISHED')

  async function submit(event) {
    event.preventDefault()
    const ok = await onSave({
      title,
      startsAt,
      place,
      seats: Number(seats),
      kind,
      price: Number(price),
      status,
    })
    if (ok) onClose()
  }

  return (
    <Modal title={game ? 'Изменить вечер' : 'Новый вечер'} eyebrow="Вечера" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="название" required />
        <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
        <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="место" required />
        <input type="number" min="1" value={seats} onChange={(event) => setSeats(event.target.value)} placeholder="мест" required />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="CLASSIC">Классика</option>
          <option value="TOURNAMENT">Турнир</option>
          <option value="NOVICE">Новички</option>
        </select>
        <input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="цена" required />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="DRAFT">Черновик</option>
          <option value="PUBLISHED">Опубликован</option>
          <option value="DONE">Завершён</option>
        </select>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit">Сохранить</button>
        </div>
      </form>
    </Modal>
  )
}

export default function GamesScreen({ me, games, reloadKey = 0, onBook, onCreate, onUpdate, onLogin }) {
  const [kindFilter, setKindFilter] = useState('ALL')
  const [weekFilter, setWeekFilter] = useState('ALL')
  const [pending, setPending] = useState(null)
  const [editor, setEditor] = useState(null)
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const eyebrow = staff ? 'Вечера' : 'Расписание'
  const title = me?.role === 'HOST' ? 'Управление ночами' : me ? 'Запись на вечер' : 'Вечера клуба'
  const week = minskWeek()
  const visible = games.filter((game) => {
    if (kindFilter !== 'ALL' && game.kind !== kindFilter) return false
    if (weekFilter === 'WEEK' && !inMinskWeek(game.startsAt, week)) return false
    return true
  })

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {!me && <p className="lede">Выберите стол, проверьте места и запишитесь. Гостям доступен просмотр; запись — после входа.</p>}
        </div>
        {staff && (
          <button type="button" className="btn-primary" onClick={() => setEditor({ mode: 'create' })}>Новый вечер</button>
        )}
      </div>
      <div className="toolbar">
        {WEEKS.map((item) => (
          <button
            key={'week-' + item.id}
            type="button"
            className="chip"
            aria-current={weekFilter === item.id ? 'page' : undefined}
            onClick={() => setWeekFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
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
      {weekFilter === 'WEEK' && visible.length === 0 && <p>На этой неделе вечеров нет</p>}
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
              {staff && (
                <button type="button" className="btn-secondary btn-s" onClick={() => setEditor({ mode: 'edit', game })}>Изменить</button>
              )}
              <button type="button" className="btn-primary btn-s" onClick={() => (me ? setPending(game) : onLogin())}>Записаться</button>
            </div>
            {staff && (
              <div className="night-card__tools">
                <span className={game.status === 'PUBLISHED' ? 'status-ok' : 'status-muted'}>{STATUS_LABEL[game.status] || game.status}</span>
              </div>
            )}
          </article>
        )
      })}
      </div>
      {pending && (
        <Modal title={pending.title} eyebrow="Запись" onClose={() => setPending(null)}>
          <p>{new Date(pending.startsAt).toLocaleString('ru')}</p>
          <p className="muted">{pending.place}</p>
          <p className="price">{pending.price > 0 ? `${pending.price} BYN` : '0 BYN'}</p>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setPending(null)}>Отмена</button>
            <button type="button" className="btn-primary" onClick={() => { onBook(pending.id); setPending(null) }}>Записаться</button>
          </div>
        </Modal>
      )}
      {editor && (
        <GameModal
          game={editor.mode === 'edit' ? editor.game : null}
          onClose={() => setEditor(null)}
          onSave={(payload) => (editor.mode === 'edit' ? onUpdate(editor.game.id, payload) : onCreate(payload))}
        />
      )}
    </section>
  )
}
