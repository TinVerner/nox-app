import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api'
import { nextRank, rankLabel } from '../ranks'

// Заявки user_ranks: игрок подаёт PENDING, ведущий подтверждает или отклоняет.
export default function RanksScreen({ me }) {
  const staff = me?.role === 'HOST'
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const playerPending = useMemo(
    () => (rows || []).some((row) => row.status === 'PENDING'),
    [rows],
  )
  const target = nextRank(me?.rank || null)
  const showForm = me?.role === 'PLAYER' && target && !playerPending

  function load() {
    apiFetch('/api/rank-requests')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    if (!target || busy) return
    setError('')
    setBusy(true)
    try {
      const response = await apiFetch('/api/rank-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rank: target.id }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'не вышло')
        return
      }
      load()
    } finally {
      setBusy(false)
    }
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
      <div className="page-head">
        <div>
          <p className="eyebrow">Ранг</p>
          <h1>Заявки на ранг</h1>
          {me?.role === 'PLAYER' ? (
            <p className="lede">
              Текущий: {me.rank ? rankLabel(me.rank) : 'без ранга'}
              {target ? ` · следующий: ${target.label}` : ' · максимальный ранг'}
            </p>
          ) : null}
        </div>
      </div>
      {me?.role === 'PLAYER' && playerPending ? (
        <p className="muted">Заявка на рассмотрении — новую подать нельзя, пока ведущий не решит.</p>
      ) : null}
      {showForm && (
        <form className="stack panel ranks-form" onSubmit={submit}>
          <p className="muted">Подать заявку на {target.label}</p>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn-primary" disabled={busy}>Подать заявку</button>
        </form>
      )}
      {me?.role === 'PLAYER' && !target && !playerPending ? (
        <p className="muted">Вы уже на максимальном ранге.</p>
      ) : null}
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="stack ranks-list">
          {rows.map((row) => (
            <article key={row.id} className="panel rank-card">
              <h2>{row.nick}</h2>
              <p className="rank-card__rank">{row.label}</p>
              <p className="muted rank-card__status">
                {row.status === 'PENDING' ? 'на рассмотрении' : row.status === 'CONFIRMED' ? 'подтверждён' : 'отклонён'}
              </p>
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
