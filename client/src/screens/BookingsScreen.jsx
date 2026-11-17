import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import CancelBookingDialog from '../components/CancelBookingDialog'
import { apiFetch } from '../api'

const STATUS = {
  CONFIRMED: 'Подтверждена',
  WAITING: 'Ожидание',
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

function guestName(guest) {
  return typeof guest === 'string' ? guest : guest?.name
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [addFor, setAddFor] = useState(null)
  const [guestNameDraft, setGuestNameDraft] = useState('')
  const [guestError, setGuestError] = useState('')
  const [adding, setAdding] = useState(false)
  const [excludeFor, setExcludeFor] = useState(null)

  useEffect(() => {
    apiFetch('/api/bookings')
      .then((r) => (r.ok ? r.json() : []))
      .then(setBookings)
      .catch(() => setBookings([]))
  }, [])

  async function confirmCancel() {
    if (canceling || !confirmId) return
    setCanceling(true)
    setCancelError('')
    try {
      const res = await apiFetch('/api/bookings/' + confirmId, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCancelError(data.error || 'не вышло')
        return
      }
      setBookings((rows) => (rows || []).filter((row) => row.id !== confirmId))
      setConfirmId(null)
    } finally {
      setCanceling(false)
    }
  }

  async function addGuest(event) {
    event.preventDefault()
    const name = guestNameDraft.trim()
    if (!name || adding || !addFor) return
    setAdding(true)
    setGuestError('')
    try {
      const res = await apiFetch('/api/bookings/' + addFor + '/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGuestError(data.error || 'не вышло')
        return
      }
      setBookings((rows) => (rows || []).map((row) => (
        row.id === addFor
          ? {
            ...row,
            taken: data.taken ?? row.taken,
            guests: [...(row.guests || []), { id: data.id, name: data.name || name }],
          }
          : row
      )))
      setAddFor(null)
      setGuestNameDraft('')
    } finally {
      setAdding(false)
    }
  }

  async function removeGuest(bookingId, guest) {
    const res = await apiFetch('/api/bookings/' + bookingId + '/guests/' + guest.id, { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return
    setBookings((rows) => (rows || []).map((row) => (
      row.id === bookingId
        ? {
          ...row,
          taken: data.taken ?? row.taken,
          guests: (row.guests || []).filter((item) => (item.id || item) !== guest.id),
        }
        : row
    )))
    setExcludeFor((current) => (
      current && current.id === bookingId
        ? { ...current, guests: current.guests.filter((item) => item.id !== guest.id) }
        : current
    ))
  }

  const excludeRow = (bookings || []).find((row) => row.id === excludeFor?.id)

  return (
    <section className="screen">
      <p className="eyebrow">Мои записи</p>
      <h1>Предстоящие и прошедшие</h1>
      {bookings === null ? null : bookings.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="night-list">
          {bookings.map((row) => {
            const when = nightParts(row.startsAt)
            const guests = (row.guests || []).map((guest) => (
              typeof guest === 'string' ? { id: guest, name: guest } : guest
            ))
            return (
              <article key={row.id} className="night-card">
                <div className="night-card__when">
                  <span>{when.label}</span>
                  <span className="night-card__time">{when.time}</span>
                </div>
                <div>
                  <h2 className="night-card__title">{row.title}</h2>
                  <p className="muted">{row.place}{row.seats != null ? ` · ${row.taken ?? 0} из ${row.seats}` : ''}</p>
                  {guests.length > 0 && <p className="muted">Гости: {guests.map(guestName).join(', ')}</p>}
                </div>
                <div className="night-card__side">
                  <span className={row.gameStatus === 'DONE' ? 'status-muted' : row.status === 'WAITING' ? 'status-wait' : 'status-ok'}>
                    {row.gameStatus === 'DONE' ? 'Сыграна' : (STATUS[row.status] || row.status)}
                    {row.gameStatus === 'DONE' && row.points != null ? ` ${row.points > 0 ? '+' : ''}${row.points}` : ''}
                  </span>
                  <button type="button" className="btn-secondary btn-s" onClick={() => { setGuestError(''); setGuestNameDraft(''); setAddFor(row.id) }}>Добавить гостя</button>
                  <button type="button" className="btn-ghost btn-s" onClick={() => setExcludeFor({ id: row.id, guests })}>Исключить гостя</button>
                  <button type="button" className="btn-ghost btn-s" onClick={() => { setCancelError(''); setConfirmId(row.id) }}>Отменить</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {confirmId && (
        <CancelBookingDialog
          busy={canceling}
          error={cancelError}
          onClose={() => { if (!canceling) setConfirmId(null) }}
          onConfirm={confirmCancel}
        />
      )}
      {addFor && (
        <Modal title="Гость" eyebrow="Запись" onClose={() => { if (!adding) setAddFor(null) }}>
          <form className="stack" onSubmit={addGuest}>
            <input value={guestNameDraft} onChange={(event) => setGuestNameDraft(event.target.value)} placeholder="имя гостя" />
            {guestError ? <p className="error">{guestError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setAddFor(null)} disabled={adding}>Отмена</button>
              <button type="submit" className="btn-primary" disabled={adding}>Добавить</button>
            </div>
          </form>
        </Modal>
      )}
      {excludeFor && (
        <Modal title="Исключить гостя" eyebrow="Запись" onClose={() => setExcludeFor(null)}>
          {(excludeRow?.guests || excludeFor.guests || []).length === 0 ? (
            <p className="muted">гостей нет</p>
          ) : (
            <div className="stack">
              {(excludeRow?.guests || excludeFor.guests).map((guest) => {
                const item = typeof guest === 'string' ? { id: guest, name: guest } : guest
                return (
                  <button key={item.id} type="button" className="btn-ghost" onClick={() => removeGuest(excludeFor.id, item)}>
                    {item.name}
                  </button>
                )
              })}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => setExcludeFor(null)}>Закрыть</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
