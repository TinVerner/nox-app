import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function MembersScreen({ onOpen }) {
  const [members, setMembers] = useState(null)
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    apiFetch('/api/members')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [])

  const visible = (members || []).filter((member) => {
    if (role && member.role !== role) return false
    const query = q.trim().toLowerCase()
    if (query && !String(member.nick).toLowerCase().includes(query)) return false
    return true
  })

  return (
    <section className="screen">
      <p className="eyebrow">Клуб</p>
      <h1>Участники</h1>
      <div className="toolbar">
        <input placeholder="ник" value={q} onChange={(event) => setQ(event.target.value)} />
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">все роли</option>
          <option value="PLAYER">игрок</option>
          <option value="HOST">ведущий</option>
          <option value="ADMIN">администратор</option>
        </select>
      </div>
      {members === null ? null : visible.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="member-grid">
          {visible.map((member) => (
            <button key={member.id} type="button" className="member-card" onClick={() => onOpen(member.id)}>
              <h2>{member.nick}</h2>
              <p>{ROLE[member.role] || member.role}</p>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
