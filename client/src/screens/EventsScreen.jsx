import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import CancelBookingDialog from '../components/CancelBookingDialog'
import Modal from '../components/Modal'

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
}

function minskNowInput() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Minsk',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const value = (type) => parts.find((part) => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

function toMinskInput(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Minsk',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

function when(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function EventModal({ item, onClose, onSave }) {
  const [draft, setDraft] = useState(item
    ? {
      eventType: item.eventType,
      title: item.title,
      description: item.description || '',
      startsAt: toMinskInput(item.startsAt),
      capacity: item.capacity ?? '',
      price: item.price ?? '',
    }
    : EMPTY)
  const [error, setError] = useState('')
  const earliest = minskNowInput()

  async function submit(event) {
    event.preventDefault()
    setError('')
    const ok = await onSave(draft)
    if (ok === false) setError('не вышло')
    else if (typeof ok === 'string') setError(ok)
    else onClose()
  }

  return (
    <Modal title={item ? 'Изменить мероприятие' : 'Создать мероприятие'} eyebrow="Клуб" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <select value={draft.eventType} onChange={(event) => setDraft({ ...draft, eventType: event.target.value })}>
          <option value="CLUB_EVENT">Мероприятие</option>
          <option value="TOURNAMENT">Турнир</option>
        </select>
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="название" required />
        <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="описание" />
        <input
          type="datetime-local"
          min={earliest}
          value={draft.startsAt}
          onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })}
          required
        />
        <input value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} placeholder="мест" inputMode="numeric" />
        <input value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="цена, BYN" inputMode="decimal" />
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Сохранить</button>
        </div>
      </form>
    </Modal>
  )
}

export default function EventsScreen({ me }) {
  const staff = me?.role === 'HOST'
  const [rows, setRows] = useState(null)
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  function load() {
    apiFetch('/api/events')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => { load() }, [])

  async function saveEvent(draft) {
    setError('')
    const editing = editor && editor !== true ? editor : null
    const path = editing ? '/api/events/' + editing.id : '/api/events'
    const response = await apiFetch(path, {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return data.error || 'не вышло'
    load()
    return true
  }

  async function removeEvent(item) {
    setError('')
    const response = await apiFetch('/api/events/' + item.id, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return setError(data.error || 'не вышло')
    }
    if (editor && editor !== true && editor.id === item.id) setEditor(null)
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

  function askCancel(item) {
    setCancelError('')
    setCancelTarget(item)
  }

  async function confirmCancel() {
    if (canceling || !cancelTarget) return
    setCanceling(true)
    setCancelError('')
    try {
      const response = await apiFetch('/api/events/' + cancelTarget.id + '/register', { method: 'DELETE' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setCancelError(data.error || 'не вышло')
        return
      }
      setCancelTarget(null)
      load()
    } finally {
      setCanceling(false)
    }
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
      <div className="page-head">
        <div>
          <p className="eyebrow">Клуб</p>
          <h1>Мероприятия</h1>
          <p className="lede">Турниры и клубные встречи. Запись хранит гостей и итоговое место.</p>
        </div>
        {staff && (
          <button type="button" className="btn-primary" onClick={() => setEditor(true)}>Создать мероприятие</button>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="stack">
          {rows.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              staff={staff}
              player={me?.role === 'PLAYER'}
              onRegister={register}
              onCancel={askCancel}
              onPlace={setPlace}
              onEdit={() => setEditor(item)}
              onDelete={removeEvent}
            />
          ))}
        </div>
      )}
      {editor && (
        <EventModal
          item={editor === true ? null : editor}
          onClose={() => setEditor(null)}
          onSave={saveEvent}
        />
      )}
      {cancelTarget && (
        <CancelBookingDialog
          busy={canceling}
          error={cancelError}
          onClose={() => { if (!canceling) setCancelTarget(null) }}
          onConfirm={confirmCancel}
        />
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

function EventCard({ item, staff, player, onRegister, onCancel, onPlace, onEdit, onDelete }) {
  return (
    <article className="panel stack">
      <h2>{item.title}</h2>
      <p className="muted">{TYPE[item.eventType] || item.eventType}</p>
      <p className="muted">{when(item.startsAt)}</p>
      {item.description ? <p>{item.description}</p> : null}
      {item.capacity != null ? (
        <p className="muted">записаны {item.taken ?? 0} из {item.capacity}</p>
      ) : null}
      {item.price != null ? <p className="muted">{item.price} BYN</p> : null}
      {staff && (
        <div className="user-actions">
          <button type="button" className="btn-secondary btn-s" onClick={onEdit}>Изменить</button>
          <button type="button" className="btn-ghost btn-s" onClick={() => onDelete(item)}>Удалить</button>
        </div>
      )}
      {player && !item.mine && (
        <div className="user-actions">
          <button type="button" className="btn-primary btn-s" onClick={() => onRegister(item, 0)}>Записаться</button>
        </div>
      )}
      {player && item.mine && (
        <>
          <p className="muted">Вы записаны</p>
          <button type="button" className="btn-ghost btn-s" onClick={() => onCancel(item)}>Отменить запись</button>
        </>
      )}
      {staff && item.registrations.length > 0 && (
        <div className="stack">
          {item.registrations.map((row) => (
            <div key={row.id} className="user-actions">
              <span>{row.nick}{row.finalPlace ? ` · место ${row.finalPlace}` : ''}</span>
              <PlaceField onSave={(value) => onPlace(item, row, value)} />
            </div>
          ))}
        </div>
      )}
    </article>
  )
}
