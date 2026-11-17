import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function SettingsScreen() {
  const [name, setName] = useState('NOX')
  const [bookingOpen, setBookingOpen] = useState(true)
  const [waitlistSize, setWaitlistSize] = useState(4)
  const [saved, setSaved] = useState(null)

  useEffect(() => {
    apiFetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((settings) => {
        if (!settings) return
        setName(settings.name)
        setBookingOpen(settings.bookingOpen)
        setWaitlistSize(settings.waitlistSize)
        setSaved(settings)
      })
      .catch(() => {})
  }, [])

  async function save(e) {
    e.preventDefault()
    const res = await apiFetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        bookingOpen,
        waitlistSize: Number(waitlistSize),
      }),
    })
    const settings = await res.json()
    if (!res.ok) return alert(settings.error || 'не вышло')
    setName(settings.name)
    setBookingOpen(settings.bookingOpen)
    setWaitlistSize(settings.waitlistSize)
    setSaved(settings)
  }

  return (
    <section className="screen">
      <form onSubmit={save}>
        <div className="page-head">
          <div>
            <p className="eyebrow">Управление клубом</p>
            <h1>Настройки клуба</h1>
            <p className="lede">Название клуба и правила записи на вечера.</p>
          </div>
          <button type="submit">Сохранить изменения</button>
        </div>
        <div className="split">
          <article className="panel stack">
            <h2>О клубе</h2>
            <label htmlFor="club-name">Название клуба</label>
            <input id="club-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="название клуба" required />
          </article>
          <article className="panel stack">
            <h2>Правила записи</h2>
            <label className="check">
              <input
                type="checkbox"
                checked={bookingOpen}
                onChange={(e) => setBookingOpen(e.target.checked)}
              />
              запись открыта
            </label>
            <label htmlFor="waitlist">Лист ожидания</label>
            <input
              id="waitlist"
              type="number"
              min="0"
              value={waitlistSize}
              onChange={(e) => setWaitlistSize(e.target.value)}
              placeholder="лист ожидания"
              required
            />
          </article>
        </div>
      </form>
      {saved && (
        <p className="muted" style={{ marginTop: 16 }}>
          {saved.name} · запись {saved.bookingOpen ? 'открыта' : 'закрыта'} · лист ожидания {saved.waitlistSize}
        </p>
      )}
    </section>
  )
}
