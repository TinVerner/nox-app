import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function MembersScreen({ onOpen }) {
  const [members, setMembers] = useState(null)

  useEffect(() => {
    apiFetch('/api/members')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [])

  return (
    <section className="screen">
      <p className="eyebrow">Клуб</p>
      <h1>Участники</h1>
      {members === null ? null : members.length === 0 ? (
        <p className="muted">Пока нет участников</p>
      ) : (
        <div className="member-grid">
          {members.map((member) => (
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
