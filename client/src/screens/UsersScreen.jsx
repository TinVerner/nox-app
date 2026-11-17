import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

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
      <p className="eyebrow">Управление клубом</p>
      <h1>Пользователи</h1>
      <div className="toolbar">
        <input placeholder="ник или email" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">все роли</option>
          <option value="PLAYER">игрок</option>
          <option value="HOST">ведущий</option>
          <option value="ADMIN">администратор</option>
        </select>
      </div>
      <table className="user-table">
        <thead>
          <tr>
            <th>Ник</th>
            <th>Email</th>
            <th>Роль</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.nick}</td>
              <td className="muted">{user.email}</td>
              <td>{ROLE[user.role] || user.role}</td>
              <td className={user.blocked ? 'status-wait' : 'status-ok'}>{user.blocked ? 'заблокирован' : 'активен'}</td>
              <td>
                <div className="user-actions">
                  <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(user.id, 'PLAYER')}>игрок</button>
                  <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(user.id, 'HOST')}>ведущий</button>
                  <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(user.id, 'ADMIN')}>администратор</button>
                  <button type="button" className="btn-danger btn-s" onClick={() => setBlocked(user.id, !user.blocked)}>
                    {user.blocked ? 'Разблокировать' : 'Заблокировать'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
