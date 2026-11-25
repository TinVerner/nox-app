import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

const KIND = {
  CLASSIC: 'Классика',
  NOVICE: 'Новички',
}

function formatWinRate(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  return Number.isInteger(n) ? `${n}%` : `${n.toFixed(1)}%`
}

function when(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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
        <div className="stack member-detail">
          <div className="panel member-panel">
            <p className="eyebrow">{ROLE[member.role] || member.role}</p>
            <h1>{member.nick}</h1>
            {member.rating && member.rating.games > 0 ? (
              <>
                <p>
                  Всего: {member.rating.points} очков, игр {member.rating.games}, win% {formatWinRate(member.rating.winRate)}
                </p>
                {member.rating.byRole?.length ? (
                  <div className="stack">
                    <p className="muted">По ролям</p>
                    {member.rating.byRole.map((row) => (
                      <p key={row.role}>
                        {row.label}: {formatWinRate(row.winRate)} ({row.wins}/{row.games})
                      </p>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="muted">в общем рейтинге нет</p>
            )}
            {member.bonus != null ? <p className="muted">бонусы: {member.bonus}</p> : null}
          </div>
          <div className="panel stack">
            <h2>Недавние вечера и записи</h2>
            {!member.recentNights?.length ? (
              <p className="muted">записей нет</p>
            ) : (
              member.recentNights.map((night) => (
                <p key={night.id + '-' + night.bookingStatus}>
                  {night.title} · {KIND[night.format] || night.format} · {when(night.startsAt)} · {night.bookingStatus}
                </p>
              ))
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}
