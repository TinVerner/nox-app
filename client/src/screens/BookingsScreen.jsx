import { useEffect, useState } from 'react'
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

function showPoints(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const text = Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100)
  return number > 0 ? `+${text}` : text
}

function bookingState(row) {
  const past = row.past || row.gameStatus === 'DONE' || (row.startsAt && new Date(row.startsAt).getTime() <= Date.now())
  if (!past) {
    return {
      label: STATUS[row.status] || row.status,
      className: row.status === 'WAITING' ? 'status-wait' : 'status-ok',
      action: 'cancel',
    }
  }
  if (row.resultsPublished) {
    const points = showPoints(row.points)
    return {
      label: points != null ? `Сыграна ${points}` : 'Сыграна',
      className: 'status-muted',
      action: 'result',
    }
  }
  return {
    label: 'Подождите, результаты ещё формируются',
    className: 'status-wait',
    action: null,
  }
}

export default function BookingsScreen({ onOpenPlayed }) {
  const [bookings, setBookings] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState('')

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
            const state = bookingState(row)
            return (
              <article key={row.id} className="night-card">
                <div className="night-card__when">
                  <span>{when.label}</span>
                  <span className="night-card__time">{when.time}</span>
                </div>
                <div>
                  <h2 className="night-card__title">{row.title}</h2>
                  <p className="muted">{row.place}{row.seats != null ? ` · ${row.taken ?? 0} из ${row.seats}` : ''}</p>
                </div>
                <div className="night-card__side">
                  <span className={state.className}>{state.label}</span>
                  {state.action === 'cancel' ? (
                    <button
                      type="button"
                      className="btn-ghost btn-s"
                      onClick={() => { setCancelError(''); setConfirmId(row.id) }}
                    >
                      Отменить
                    </button>
                  ) : null}
                  {state.action === 'result' ? (
                    <button
                      type="button"
                      className="btn-secondary btn-s"
                      onClick={() => onOpenPlayed?.(row.gameId)}
                    >
                      Смотреть результат
                    </button>
                  ) : null}
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
    </section>
  )
}
