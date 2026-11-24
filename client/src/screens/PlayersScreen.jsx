import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'
import { rankLabel } from '../ranks'

const ROLE = {
  PLAYER: 'игрок',
  HOST: 'ведущий',
  ADMIN: 'администратор',
}

export default function PlayersScreen({ onOpen }) {
  const [rows, setRows] = useState(null)
  const [selected, setSelected] = useState(null)
  const [bonus, setBonus] = useState('')
  const [error, setError] = useState('')

  function load() {
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
          bonus: member.bonus,
        })))
      })
      .catch(() => setRows([]))
  }

  useEffect(() => {
    load()
  }, [])

  function openBonus(row) {
    setError('')
    setBonus(String(row.bonus ?? 0))
    setSelected(row)
  }

  async function saveBonus() {
    if (!selected) return
    const res = await apiFetch('/api/users/' + selected.id + '/bonus', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bonus: Number(bonus) }),
    })
    const updated = await res.json().catch(() => ({}))
    if (!res.ok) return setError(updated.error || 'не вышло')
    setRows((list) => (list || []).map((row) => (
      row.id === selected.id ? { ...row, bonus: updated.bonus } : row
    )))
    setSelected((current) => (current ? { ...current, bonus: updated.bonus } : current))
    setBonus(String(updated.bonus ?? 0))
    setError('')
  }

  return (
    <section className="screen">
      <p className="eyebrow">Ведущий</p>
      <h1>Игроки</h1>
      <p className="lede">Список участников и корректировка бонусов. Подтверждение рангов — в заявках.</p>
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="member-grid">
          {rows.map((row) => (
            <article key={row.id} className="member-card">
              <button type="button" className="btn-ghost btn-s" onClick={() => onOpen(row.id)}>{row.nick}</button>
              <p>{ROLE[row.role] || row.role}{rankLabel(row.rank) ? ` · ${rankLabel(row.rank)}` : ''}</p>
              <p>бонусы: {row.bonus == null ? '—' : row.bonus}</p>
              {row.rating ? (
                <p>{row.rating.points} очков, игр {row.rating.games}</p>
              ) : (
                <p>в рейтинге нет</p>
              )}
              <button type="button" className="btn-secondary btn-s" onClick={() => openBonus(row)}>Баланс</button>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <Modal title={selected.nick} eyebrow="Бонусы" onClose={() => { setError(''); setSelected(null) }}>
          <div className="user-card">
            <div className="user-rank">
              <label htmlFor="player-bonus">Баланс бонусов</label>
              <input id="player-bonus" type="number" step="0.01" value={bonus} onChange={(event) => setBonus(event.target.value)} />
              <button type="button" className="btn-secondary btn-s" onClick={saveBonus}>Сохранить баланс</button>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => { setError(''); setSelected(null) }}>Закрыть</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
