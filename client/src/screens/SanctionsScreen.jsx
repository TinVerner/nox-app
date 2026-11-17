import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const KINDS = [
  { id: 'LATE_10', label: 'Опоздание на 10 минут, −5' },
  { id: 'LATE_MORE', label: 'Опоздание больше 10 минут, −10' },
  { id: 'NO_SHOW', label: 'Не пришёл, −15 и предупреждение' },
  { id: 'WARNING', label: 'Предупреждение' },
]

export default function SanctionsScreen() {
  const [rows, setRows] = useState(null)
  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState('')
  const [kind, setKind] = useState('LATE_10')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function load() {
    apiFetch('/api/sanctions')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRows)
      .catch(() => setRows([]))
  }

  useEffect(() => {
    load()
    apiFetch('/api/users')
      .then((response) => (response.ok ? response.json() : []))
      .then((list) => {
        setUsers(list)
        if (list[0]) setUserId(list[0].id)
      })
      .catch(() => setUsers([]))
  }, [])

  async function save(event) {
    event.preventDefault()
    setError('')
    const res = await apiFetch('/api/sanctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, kind, reason }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'не вышло')
    setReason('')
    load()
  }

  return (
    <section className="screen">
      <p className="eyebrow">Управление клубом</p>
      <h1>Санкции</h1>
      <p className="lede">Опоздание на 10 минут — минус 5 бонусов. Дольше — минус 10. Неявка — минус 15 и предупреждение.</p>
      <form className="panel stack" onSubmit={save}>
        <select value={userId} onChange={(event) => setUserId(event.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.nick}</option>
          ))}
        </select>
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          {KINDS.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
        <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="причина" required />
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn-primary">Записать</button>
      </form>
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="stack">
          {rows.map((row) => (
            <article key={row.id} className="panel">
              <h2>{row.nick}</h2>
              <p>{KINDS.find((item) => item.id === row.kind)?.label || row.kind}</p>
              <p className="muted">{row.reason} · {row.bonusDelta}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
