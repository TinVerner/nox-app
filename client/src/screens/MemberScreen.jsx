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
      <button type="button" onClick={onBack}>Назад</button>
      {missing ? (
        <p>не найдено</p>
      ) : member ? (
        <>
          <h1>{member.nick}</h1>
          <p>{ROLE[member.role] || member.role}</p>
          {member.rating ? (
            <p>{member.rating.points} очков, игр {member.rating.games}</p>
          ) : (
            <p>в рейтинге нет</p>
          )}
        </>
      ) : null}
    </section>
  )
}
