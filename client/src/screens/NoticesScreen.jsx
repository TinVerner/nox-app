import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

// Список notifications. Открытие экрана помечает непрочитанные прочитанными.
export default function NoticesScreen() {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    apiFetch('/api/notifications')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }, [])

  return (
    <section className="screen">
      <p className="eyebrow">Клуб</p>
      <h1>Уведомления</h1>
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="stack">
          {rows.map((row) => (
            <article key={row.id} className="panel">
              <p>{row.message}</p>
              <p className="muted">{new Date(row.createdAt).toLocaleString('ru')}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
