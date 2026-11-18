import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

// Список notifications. Плашка про запись на вечер здесь не живёт: она гаснет сама.
export default function NoticesScreen() {
  const [rows, setRows] = useState(null)

  function load() {
    apiFetch('/api/notifications')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => { load() }, [])

  async function markRead(id) {
    const response = await apiFetch('/api/notifications/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    })
    if (!response.ok) return
    setRows((list) => (list || []).map((row) => (row.id === id ? { ...row, isRead: true } : row)))
  }

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
              <p className="muted">{row.isRead ? 'прочитано' : 'новое'} · {new Date(row.createdAt).toLocaleString('ru')}</p>
              {!row.isRead && (
                <button type="button" className="btn-secondary btn-s" onClick={() => markRead(row.id)}>Прочитано</button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
