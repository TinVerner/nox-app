import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { RANKS } from '../ranks'

// Заявки user_ranks: игрок подаёт PENDING, ведущий и админ подтверждают или отклоняют.
export default function RanksScreen({ me }) {
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const [rows, setRows] = useState(null)
  const [rank, setRank] = useState('MASTER')
  const [error, setError] = useState('')

  function load() {
    apiFetch('/api/rank-requests')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    setError('')
    const response = await apiFetch('/api/rank-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rank }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error || 'не вышло')
      return
    }
    load()
  }

  async function decide(id, status) {
    const response = await apiFetch('/api/rank-requests/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) return
    load()
  }

  return (
    <section className="screen">
      <p className="eyebrow">Ранг</p>
      <h1>Заявки на ранг</h1>
      {me?.role === 'PLAYER' && (
        <form className="stack panel" onSubmit={submit}>
          <select value={rank} onChange={(event) => setRank(event.target.value)}>
            {RANKS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit">Подать заявку</button>
        </form>
      )}
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="stack">
          {rows.map((row) => (
            <article key={row.id} className="panel rank-card">
              <h2>{row.nick}</h2>
              <p>{row.label} · {row.status === 'PENDING' ? 'на рассмотрении' : row.status === 'CONFIRMED' ? 'подтверждён' : 'отклонён'}</p>
              {staff && row.status === 'PENDING' && (
                <div className="user-actions">
                  <button type="button" className="btn-primary btn-s" onClick={() => decide(row.id, 'CONFIRMED')}>Подтвердить</button>
                  <button type="button" className="btn-ghost btn-s" onClick={() => decide(row.id, 'REJECTED')}>Отклонить</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
