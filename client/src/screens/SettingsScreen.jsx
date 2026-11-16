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
      <h1>Настройки</h1>
      <form onSubmit={save}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="название клуба" required />
        <label>
          <input
            type="checkbox"
            checked={bookingOpen}
            onChange={(e) => setBookingOpen(e.target.checked)}
          />
          запись открыта
        </label>
        <input
          type="number"
          min="0"
          value={waitlistSize}
          onChange={(e) => setWaitlistSize(e.target.value)}
          placeholder="лист ожидания"
          required
        />
        <button>Сохранить</button>
      </form>
      {saved && (
        <p>
          {saved.name} · запись {saved.bookingOpen ? 'открыта' : 'закрыта'} · лист ожидания {saved.waitlistSize}
        </p>
      )}
    </section>
  )
}
