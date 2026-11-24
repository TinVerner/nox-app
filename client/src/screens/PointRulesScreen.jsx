import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const FORMATS = [
  { id: 'CLASSIC', label: 'Классика' },
  { id: 'TOURNAMENT', label: 'Турнир' },
  { id: 'NOVICE', label: 'Новички' },
]
const ROLES = [
  { id: 'CIVILIAN', label: 'мирный житель' },
  { id: 'SHERIFF', label: 'шериф' },
  { id: 'MAFIA', label: 'мафия' },
  { id: 'DON', label: 'дон' },
]
const RESULTS = [
  { id: 'CITY', label: 'мирный город' },
  { id: 'MAFIA', label: 'мафия' },
]

export default function PointRulesScreen() {
  const [rules, setRules] = useState(null)
  const [format, setFormat] = useState('CLASSIC')
  const [playerRole, setPlayerRole] = useState(ROLES[0].id)
  const [gameResult, setGameResult] = useState(RESULTS[0].id)
  const [points, setPoints] = useState('1')
  const [error, setError] = useState('')

  function load() {
    apiFetch('/api/point-rules')
      .then((response) => (response.ok ? response.json() : []))
      .then(setRules)
      .catch(() => setRules([]))
  }

  useEffect(() => {
    load()
  }, [])

  async function save(event) {
    event.preventDefault()
    setError('')
    const res = await apiFetch('/api/point-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, playerRole, gameResult, points: Number(points) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'не вышло')
    setRules((rows) => [...(rows || []), data])
  }

  async function toggle(rule) {
    const res = await apiFetch('/api/point-rules/' + rule.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rule.isActive }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return
    setRules((rows) => rows.map((item) => (item.id === rule.id ? data : item)))
  }

  return (
    <section className="screen">
      <p className="eyebrow">Администратор</p>
      <h1>Правила начисления</h1>
      <p className="lede">Базовые очки партии: формат, роль и сторона победы. Уже опубликованные результаты от правки правил не меняются.</p>
      <form className="panel stack" onSubmit={save}>
        <select value={format} onChange={(event) => setFormat(event.target.value)}>
          {FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select value={playerRole} onChange={(event) => setPlayerRole(event.target.value)}>
          {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
        </select>
        <select value={gameResult} onChange={(event) => setGameResult(event.target.value)}>
          {RESULTS.map((result) => <option key={result.id} value={result.id}>{result.label}</option>)}
        </select>
        <input type="number" min="0" step="0.25" value={points} onChange={(event) => setPoints(event.target.value)} placeholder="очки" required />
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" className="btn-primary">Добавить правило</button>
      </form>
      {rules === null ? null : rules.length === 0 ? <p className="muted">пусто</p> : (
        <div className="stack">
          {rules.map((rule) => (
            <article key={rule.id} className="panel">
              <h2>{FORMATS.find((item) => item.id === rule.format)?.label || rule.format}</h2>
              <p>{ROLES.find((item) => item.id === rule.playerRole)?.label || rule.playerRole} · {RESULTS.find((item) => item.id === rule.gameResult)?.label || rule.gameResult} · {rule.points}</p>
              <button type="button" className="btn-ghost btn-s" onClick={() => toggle(rule)}>
                {rule.isActive ? 'Выключить' : 'Включить'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
