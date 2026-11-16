import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'Игрок',
  HOST: 'Ведущий',
  ADMIN: 'Администратор',
}

export default function MembersScreen() {
  const [members, setMembers] = useState(null)

  useEffect(() => {
    apiFetch('/api/members')
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => setMembers([]))
  }, [])

  return (
    <section className="screen">
      <h1>Участники</h1>
      {members === null ? null : members.length === 0 ? (
        <p>Пока нет участников</p>
      ) : (
        <div className="member-grid">
          {members.map((member) => (
            <article key={member.id} className="member-card">
              <h2>{member.nick}</h2>
              <p>{ROLE[member.role] || member.role}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
