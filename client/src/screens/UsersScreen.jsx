import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function UsersScreen() {
  const [users, setUsers] = useState(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')

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

  function apply(updated) {
    setUsers((rows) => rows.map((user) => (user.id === updated.id ? updated : user)))
    setSelected((current) => (current && current.id === updated.id ? updated : current))
  }

  async function setUserRole(id, nextRole) {
    const res = await apiFetch('/api/users/' + id + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    })
    const updated = await res.json()
    if (!res.ok) return setError(updated.error || 'не вышло')
    setError('')
    apply(updated)
  }

  async function setBlocked(id, blocked) {
    const res = await apiFetch('/api/users/' + id + '/block', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked }),
    })
    const updated = await res.json()
    if (!res.ok) return setError(updated.error || 'не вышло')
    setError('')
    apply(updated)
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
          </tr>
        </thead>
        <tbody>
          {(users || []).map((user) => (
            <tr key={user.id} onClick={() => { setError(''); setSelected(user) }}>
              <td>{user.nick}</td>
              <td className="muted">{user.email}</td>
              <td>{ROLE[user.role] || user.role}</td>
              <td className={user.blocked ? 'status-wait' : 'status-ok'}>{user.blocked ? 'заблокирован' : 'активен'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {users !== null && users.length === 0 && <p className="muted">пусто</p>}
      {selected && (
        <Modal title={selected.nick} eyebrow="Пользователь" onClose={() => { setError(''); setSelected(null) }}>
          <p>Ник: {selected.nick}</p>
          <p>Email: {selected.email}</p>
          <p>Роль: {ROLE[selected.role] || selected.role}</p>
          <p className={selected.blocked ? 'status-wait' : 'status-ok'}>
            {selected.blocked ? 'заблокирован' : 'активен'}
          </p>
          {error && <p className="error">{error}</p>}
          <div className="user-actions">
            <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(selected.id, 'PLAYER')}>PLAYER</button>
            <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(selected.id, 'HOST')}>HOST</button>
            <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(selected.id, 'ADMIN')}>ADMIN</button>
            <button type="button" className="btn-danger btn-s" onClick={() => setBlocked(selected.id, !selected.blocked)}>
              {selected.blocked ? 'Разблокировать' : 'Заблокировать'}
            </button>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => { setError(''); setSelected(null) }}>Закрыть</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
