import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const TYPE = {
  TOURNAMENT: 'Турнир',
  CLUB_EVENT: 'Мероприятие',
}

const EMPTY = {
  eventType: 'CLUB_EVENT',
  title: '',
  description: '',
  startsAt: '',
  capacity: '',
  price: '',
  imagePath: '',
}

function when(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function EventsScreen({ me }) {
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const [rows, setRows] = useState(null)
  const [draft, setDraft] = useState(EMPTY)
  const [error, setError] = useState('')

  function load() {
    apiFetch('/api/events')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => { load() }, [])

  async function createEvent(event) {
    event.preventDefault()
    setError('')
    const response = await apiFetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || 'не вышло')
    setDraft(EMPTY)
    load()
  }

  async function register(item, guestCount) {
    setError('')
    const response = await apiFetch('/api/events/' + item.id + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestCount }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || 'не вышло')
    load()
  }

  async function cancel(item) {
    setError('')
    const response = await apiFetch('/api/events/' + item.id + '/register', { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return setError(data.error || 'не вышло')
    }
    load()
  }

  async function setPlace(item, registration, finalPlace) {
    setError('')
    const response = await apiFetch('/api/events/' + item.id + '/registrations/' + registration.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finalPlace }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return setError(data.error || 'не вышло')
    }
    load()
  }

  return (
    <section className="screen">
      <p className="eyebrow">Клуб</p>
      <h1>Мероприятия</h1>
      <p className="lede">Турниры и клубные встречи. Запись хранит гостей и итоговое место.</p>
      {staff && (
        <form className="panel stack" onSubmit={createEvent}>
          <select value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}>
            <option value="CLUB_EVENT">Мероприятие</option>
            <option value="TOURNAMENT">Турнир</option>
          </select>
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="название" required />
          <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="описание" />
          <input type="datetime-local" value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} required />
          <input value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} placeholder="мест" inputMode="numeric" />
          <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="цена, BYN" inputMode="decimal" />
          <input value={draft.imagePath} onChange={(event) => setDraft({ ...draft, imagePath: event.target.value })} placeholder="картинка, ссылка" />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn-primary">Добавить</button>
        </form>
      )}
      {rows === null ? null : rows.length === 0 ? (
        <p className={staff ? 'muted form-follow' : 'muted'}>пусто</p>
      ) : (
        <div className={staff ? 'stack form-follow' : 'stack'}>
          {!staff && error ? <p className="error">{error}</p> : null}
          {rows.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              staff={staff}
              player={me?.role === 'PLAYER'}
              onRegister={register}
              onCancel={cancel}
              onPlace={setPlace}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function PlaceField({ onSave }) {
  const [place, setPlace] = useState('')
  return (
    <>
      <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="место" inputMode="numeric" />
      <button type="button" className="btn-secondary btn-s" onClick={() => onSave(place)}>Сохранить место</button>
    </>
  )
}

function EventCard({ item, staff, player, onRegister, onCancel, onPlace }) {
  const [guests, setGuests] = useState('0')

  return (
    <article className="panel stack">
      <h2>{item.title}</h2>
      <p className="muted">{TYPE[item.eventType] || item.eventType} · {when(item.startsAt)} · {item.status}</p>
      {item.description ? <p>{item.description}</p> : null}
      <p className="muted">
        {item.hostNick ? `ведущий ${item.hostNick}` : ''}
        {item.capacity != null ? ` · мест ${item.capacity}` : ''}
        {item.price != null ? ` · ${item.price} BYN` : ''}
      </p>
      {item.imagePath ? <p className="muted">{item.imagePath}</p> : null}
      {player && !item.mine && (
        <div className="user-actions">
          <input value={guests} onChange={(event) => setGuests(event.target.value)} placeholder="гости" inputMode="numeric" />
          <button type="button" className="btn-primary btn-s" onClick={() => onRegister(item, guests)}>Записаться</button>
        </div>
      )}
      {player && item.mine && (
        <div className="user-actions">
          <p className="muted">Вы записаны · гостей {item.mine.guestCount}{item.mine.finalPlace ? ` · место ${item.mine.finalPlace}` : ''}</p>
          <button type="button" className="btn-ghost btn-s" onClick={() => onCancel(item)}>Отменить запись</button>
        </div>
      )}
      {staff && item.registrations.length > 0 && (
        <div className="stack">
          {item.registrations.map((row) => (
            <div key={row.id} className="user-actions">
              <span>{row.nick} · гостей {row.guestCount}{row.finalPlace ? ` · место ${row.finalPlace}` : ''}</span>
              <PlaceField onSave={(value) => onPlace(item, row, value)} />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
