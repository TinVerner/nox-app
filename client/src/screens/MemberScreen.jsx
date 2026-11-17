import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function MemberScreen({ memberId, onBack }) {
  const [member, setMember] = useState(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!memberId) return
    setMember(null)
    setMissing(false)
    apiFetch('/api/members/' + memberId)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) setMissing(true)
        else setMember(data)
      })
      .catch(() => setMissing(true))
  }, [memberId])

  return (
    <section className="screen">
      <button type="button" className="btn-ghost btn-s" onClick={onBack}>Назад</button>
      {missing ? (
        <p className="muted">не найдено</p>
      ) : member ? (
        <div className="panel member-panel">
          <p className="eyebrow">{ROLE[member.role] || member.role}</p>
          <h1>{member.nick}</h1>
          {member.rating ? (
            <p>{member.rating.points} очков, игр {member.rating.games}</p>
          ) : (
            <p className="muted">в рейтинге нет</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
