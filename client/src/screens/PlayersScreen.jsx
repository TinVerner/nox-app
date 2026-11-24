import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import { RANKS, rankLabel } from '../ranks'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function PlayersScreen({ onOpen }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    Promise.all([
      apiFetch('/api/members').then((r) => (r.ok ? r.json() : [])),
      apiFetch('/api/rating').then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([members, rating]) => {
        const byNick = new Map((rating || []).map((row) => [row.nick, row]))
        setRows((members || []).map((member) => ({
          id: member.id,
          nick: member.nick,
          role: member.role,
          rating: byNick.get(member.nick) || null,
          rank: member.rank,
        })))
      })
      .catch(() => setRows([]))
  }, [])

  return (
    <section className="screen">
      <p className="eyebrow">Ведущий</p>
      <h1>Игроки</h1>
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="member-grid">
          {rows.map((row) => (
            <article key={row.id} className="member-card">
              <button type="button" className="btn-ghost btn-s" onClick={() => onOpen(row.id)}>{row.nick}</button>
              <p>{ROLE[row.role] || row.role}{rankLabel(row.rank) ? ` · ${rankLabel(row.rank)}` : ''}</p>
              <select value={row.rank || ''} onChange={() => {}}>
                {RANKS.map((rank) => (
                  <option key={rank.id} value={rank.id}>{rank.label}</option>
                ))}
              </select>
              {row.rating ? (
                <p>{row.rating.points} очков, игр {row.rating.games}</p>
              ) : (
                <p>в рейтинге нет</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
