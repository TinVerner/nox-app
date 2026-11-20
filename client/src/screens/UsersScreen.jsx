import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'
import { RANKS } from '../ranks'

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
  const [bonus, setBonus] = useState('')
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

  async function setRank(id, rank) {
    if (rank) {
      setError('заявку подаёт игрок')
      return
    }
    const res = await apiFetch('/api/members/' + id + '/rank', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rank }),
    })
    const updated = await res.json()
    if (!res.ok) return setError(updated.error || 'не вышло')
    setError('')
    setUsers((list) => (list || []).map((user) => (user.id === id ? { ...user, rank: updated.rank } : user)))
    setSelected((current) => (current && current.id === id ? { ...current, rank: updated.rank } : current))
  }

  function openUser(user) {
    setError('')
    setBonus(String(user.bonus ?? 0))
    setSelected(user)
  }

  async function saveBonus(id) {
    const res = await apiFetch('/api/users/' + id + '/bonus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bonus: Number(bonus) }),
    })
    const updated = await res.json()
    if (!res.ok) return setError(updated.error || 'не вышло')
    setError('')
    apply(updated)
    setBonus(String(updated.bonus ?? 0))
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

  const needle = q.trim().toLocaleLowerCase('ru')
  const visible = (users || []).filter((user) => {
    if (role && user.role !== role) return false
    if (!needle) return true
    const nick = String(user.nick || '').toLocaleLowerCase('ru')
    const email = String(user.email || '').toLocaleLowerCase('ru')
    return nick.includes(needle) || email.includes(needle)
  })

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
        <colgroup>
          <col className="col-nick" />
          <col className="col-email" />
          <col className="col-role" />
          <col className="col-status" />
        </colgroup>
        <thead>
          <tr>
            <th>Ник</th>
            <th>Email</th>
            <th>Роль</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((user) => (
            <tr key={user.id} onClick={() => openUser(user)}>
              <td>{user.nick}</td>
              <td className="muted">{user.email}</td>
              <td>{ROLE[user.role] || user.role}</td>
              <td className={user.blocked ? 'status-wait' : 'status-ok'}>{user.blocked ? 'заблокирован' : 'активен'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {users !== null && visible.length === 0 && <p className="muted">пусто</p>}
      {selected && (
        <Modal title={selected.nick} eyebrow="Пользователь" onClose={() => { setError(''); setSelected(null) }}>
          <div className="user-card">
          <p>Ник: {selected.nick}</p>
          <p>Email: {selected.email}</p>
          <p>Роль: {ROLE[selected.role] || selected.role}</p>
          <p className={selected.blocked ? 'status-wait' : 'status-ok'}>
            {selected.blocked ? 'заблокирован' : 'активен'}
          </p>
          <div className="user-rank">
            <label htmlFor="user-bonus">Бонусы</label>
            <input id="user-bonus" type="number" step="0.01" value={bonus} onChange={(event) => setBonus(event.target.value)} />
            <button type="button" className="btn-secondary btn-s" onClick={() => saveBonus(selected.id)}>Сохранить баланс</button>
          </div>
          <div className="user-rank">
            <label htmlFor="user-rank">Ранг</label>
            <select id="user-rank" value={selected.rank || ''} onChange={(event) => setRank(selected.id, event.target.value)}>
              <option value="">без ранга</option>
              {RANKS.map((rank) => (
                <option key={rank.id} value={rank.id}>{rank.label}</option>
              ))}
            </select>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="user-actions">
            <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(selected.id, 'PLAYER')}>PLAYER</button>
            <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(selected.id, 'HOST')}>HOST</button>
            <button type="button" className="btn-secondary btn-s" onClick={() => setUserRole(selected.id, 'ADMIN')}>ADMIN</button>
            <button type="button" className="btn-danger btn-s" onClick={() => setBlocked(selected.id, !selected.blocked)}>
              {selected.blocked ? 'Разблокировать' : 'Заблокировать'}
            </button>
          </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => { setError(''); setSelected(null) }}>Закрыть</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
