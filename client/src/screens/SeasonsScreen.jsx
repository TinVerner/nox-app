import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

const EMPTY_SEASON = { name: '', startsOn: '', endsOn: '' }

function SeasonCreateModal({ onClose, onSave }) {
  const [draft, setDraft] = useState(EMPTY_SEASON)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    const ok = await onSave(draft)
    if (ok === false) setError('не вышло')
    else if (typeof ok === 'string') setError(ok)
    else onClose()
  }

  return (
    <Modal title="Новый сезон" eyebrow="Сезоны" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="muted">Текущий открытый сезон не закрывается — можно создать будущий заранее.</p>
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder="название, например Зима 2027"
          required
        />
        <label>
          Начало
          <input
            type="date"
            value={draft.startsOn}
            onChange={(event) => setDraft({ ...draft, startsOn: event.target.value })}
            required
          />
        </label>
        <label>
          Окончание
          <input
            type="date"
            value={draft.endsOn}
            onChange={(event) => setDraft({ ...draft, endsOn: event.target.value })}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Создать</button>
        </div>
      </form>
    </Modal>
  )
}

function SeasonRating({ seasonId }) {
  const [rating, setRating] = useState(null)

  useEffect(() => {
    if (!seasonId) {
      setRating([])
      return
    }
    let cancelled = false
    apiFetch('/api/seasons/' + seasonId + '/rating')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (!cancelled) setRating(rows) })
      .catch(() => { if (!cancelled) setRating([]) })
    return () => { cancelled = true }
  }, [seasonId])

  const listed = (rating || []).filter((row) => Number(row.points) !== 0 || row.games > 0)

  return (
    <div>
      <h3>Рейтинг сезона</h3>
      {rating === null ? null : listed.length === 0 ? (
        <p className="muted">пока нет очков</p>
      ) : (
        <div className="rating-rows">
          {listed.map((row, index) => (
            <article key={row.id} className="rating-row">
              <span className="muted">{index + 1}</span>
              <span className="rating-nick">
                <span>{row.nick}</span>
                {row.rank ? <span className="muted">{row.rank}</span> : null}
              </span>
              <span>{row.points} очков</span>
              <span className="muted">игр {row.games}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SeasonsScreen() {
  const [seasons, setSeasons] = useState(null)
  const [pending, setPending] = useState(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  function loadSeasons() {
    return apiFetch('/api/seasons')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        setSeasons(rows)
        return rows
      })
      .catch(() => {
        setSeasons([])
        return []
      })
  }

  useEffect(() => {
    loadSeasons()
  }, [])

  async function createSeason(draft) {
    setError('')
    const res = await apiFetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return data.error || 'не вышло'
    await loadSeasons()
    return true
  }

  async function closeSeason() {
    if (!pending) return
    const res = await apiFetch('/api/seasons/' + pending.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closed: true }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'не вышло')
      return
    }
    const updated = await res.json()
    setSeasons((rows) => rows.map((season) => (season.id === pending.id ? updated : season)))
    setError('')
    setPending(null)
  }

  const open = (seasons || []).filter((season) => !season.closed)
  const closed = (seasons || []).filter((season) => season.closed)

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Сезоны</p>
          <h1>Сезоны клуба</h1>
          <p className="lede">
            Можно создать будущий сезон, не закрывая текущий. «Закрыть сезон» прячет вечера этого сезона из открытого расписания.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>Создать сезон</button>
      </div>
      <div className="stack">
        {seasons !== null && open.length === 0 && closed.length === 0 && <p className="muted">пусто</p>}
        {open.map((season) => (
          <article key={season.id} className="panel stack">
            <p className="eyebrow">{open.length > 1 ? 'Открытый сезон' : 'Текущий сезон'}</p>
            <h2>{season.name}</h2>
            <p className="muted">
              {season.startsOn ? new Date(season.startsOn).toLocaleDateString('ru-RU') : ''}
              {season.endsOn ? ` — ${new Date(season.endsOn).toLocaleDateString('ru-RU')}` : ''}
            </p>
            <button type="button" className="btn-danger btn-s" onClick={() => setPending(season)}>Закрыть сезон</button>
            <SeasonRating seasonId={season.id} />
          </article>
        ))}
        {closed.length > 0 && (
          <div className="panel">
            <h2>Архив сезонов</h2>
            {closed.map((season) => (
              <p key={season.id}>{season.name} · закрыт</p>
            ))}
          </div>
        )}
      </div>
      {creating && (
        <SeasonCreateModal onClose={() => setCreating(false)} onSave={createSeason} />
      )}
      {pending && (
        <Modal title="Закрыть сезон" eyebrow="Сезоны" onClose={() => { setError(''); setPending(null) }}>
          <p>
            Закрыть «{pending.name}»? Вечера этого сезона пропадут из открытого расписания для гостей и игроков.
            Другие открытые сезоны останутся.
          </p>
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={() => { setError(''); setPending(null) }}>Отмена</button>
            <button type="button" className="btn-danger" onClick={closeSeason}>Закрыть сезон</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
