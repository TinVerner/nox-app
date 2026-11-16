import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const STATUS = {
  CONFIRMED: 'подтверждена',
  WAITING: 'лист ожидания',
}

export default function BookingsScreen() {
  const [bookings, setBookings] = useState(null)

  useEffect(() => {
    apiFetch('/api/bookings')
      .then((r) => (r.ok ? r.json() : []))
      .then(setBookings)
      .catch(() => setBookings([]))
  }, [])

  async function cancel(id) {
    const res = await apiFetch('/api/bookings/' + id, { method: 'DELETE' })
    if (!res.ok) return
    setBookings((rows) => rows.filter((row) => row.id !== id))
  }

  return (
    <section className="screen">
      <h1>Мои записи</h1>
      {bookings === null ? null : bookings.length === 0 ? (
        <p>Записей нет</p>
      ) : (
        bookings.map((row) => (
          <article key={row.id} className="game-row">
            <span className="game-row__date">
              {row.startsAt ? new Date(row.startsAt).toLocaleString('ru') : ''}
            </span>
            <h2 className="game-row__title">{row.title}</h2>
            <span>{row.place}</span>
            <span>мест: {row.seats}</span>
            <span>{STATUS[row.status] || row.status}</span>
            <button type="button" onClick={() => cancel(row.id)}>Отменить</button>
          </article>
        ))
      )}
    </section>
  )
}
