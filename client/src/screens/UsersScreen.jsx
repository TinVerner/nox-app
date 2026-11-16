import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function UsersScreen() {
  const [users, setUsers] = useState([])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    if (role) params.set('role', role)
    const query = params.toString()
    apiFetch('/api/users' + (query ? '?' + query : ''))
      .then((r) => (r.ok ? r.json() : []))
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [q, role])

  async function setUserRole(id, nextRole) {
    const res = await apiFetch('/api/users/' + id + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    })
    const updated = await res.json()
    if (!res.ok) return alert(updated.error || 'не вышло')
    setUsers((rows) => rows.map((user) => (user.id === id ? updated : user)))
  }

  async function setBlocked(id, blocked) {
    const res = await apiFetch('/api/users/' + id + '/block', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked }),
    })
    const updated = await res.json()
    if (!res.ok) return alert(updated.error || 'не вышло')
    setUsers((rows) => rows.map((user) => (user.id === id ? updated : user)))
  }

  return (
    <section className="screen">
      <h1>Люди</h1>
      <input placeholder="ник или email" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="">все роли</option>
        <option value="PLAYER">PLAYER</option>
        <option value="HOST">HOST</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      {users.map((user) => (
        <p key={user.id}>
          {user.nick} · {user.email} · {user.role}
          {user.blocked ? ' · заблокирован' : ''}{' '}
          <button type="button" onClick={() => setUserRole(user.id, 'PLAYER')}>PLAYER</button>{' '}
          <button type="button" onClick={() => setUserRole(user.id, 'HOST')}>HOST</button>{' '}
          <button type="button" onClick={() => setUserRole(user.id, 'ADMIN')}>ADMIN</button>{' '}
          <button type="button" onClick={() => setBlocked(user.id, !user.blocked)}>
            {user.blocked ? 'Разблокировать' : 'Заблокировать'}
          </button>
        </p>
      ))}
    </section>
  )
}
