import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

const FORMATS = [
  { id: 'CLASSIC', label: 'Классика' },
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

const EMPTY = {
  format: 'CLASSIC',
  playerRole: ROLES[0].id,
  gameResult: RESULTS[0].id,
  points: '1',
}

function RuleModal({ rule, onClose, onSave }) {
  const [draft, setDraft] = useState(rule
    ? {
      format: rule.format,
      playerRole: rule.playerRole,
      gameResult: rule.gameResult,
      points: String(rule.points),
    }
    : EMPTY)
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
    <Modal title={rule ? 'Изменить правило' : 'Новое правило'} eyebrow="Очки" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <select value={draft.format} onChange={(event) => setDraft({ ...draft, format: event.target.value })}>
          {FORMATS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select value={draft.playerRole} onChange={(event) => setDraft({ ...draft, playerRole: event.target.value })}>
          {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
        </select>
        <select value={draft.gameResult} onChange={(event) => setDraft({ ...draft, gameResult: event.target.value })}>
          {RESULTS.map((result) => <option key={result.id} value={result.id}>{result.label}</option>)}
        </select>
        <input type="number" min="0" step="0.25" value={draft.points} onChange={(event) => setDraft({ ...draft, points: event.target.value })} placeholder="очки" required />
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Сохранить</button>
        </div>
      </form>
    </Modal>
  )
}

export default function PointRulesScreen() {
  const [rules, setRules] = useState(null)
  const [editor, setEditor] = useState(null)
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

  async function saveRule(draft) {
    setError('')
    const editing = editor && editor !== true ? editor : null
    const response = await apiFetch(editing ? '/api/point-rules/' + editing.id : '/api/point-rules', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        format: draft.format,
        playerRole: draft.playerRole,
        gameResult: draft.gameResult,
        points: Number(draft.points),
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return data.error || 'не вышло'
    if (editing) {
      setRules((rows) => (rows || []).map((row) => (row.id === data.id ? data : row)))
    } else {
      setRules((rows) => [...(rows || []), data])
    }
    return true
  }

  async function removeRule(rule) {
    setError('')
    const response = await apiFetch('/api/point-rules/' + rule.id, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return setError(data.error || 'не вышло')
    }
    setRules((rows) => (rows || []).filter((row) => row.id !== rule.id))
  }

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Ведущий</p>
          <h1>Правила начисления</h1>
          <p className="lede">Базовые очки партии: формат, роль и сторона победы. Уже опубликованные результаты от правки правил не меняются.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditor(true)}>Создать правило</button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {rules === null ? null : rules.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="catalog-grid">
          {rules.map((rule) => (
            <article key={rule.id} className="catalog-tile">
              <div className="catalog-tile__body">
                <h2>{FORMATS.find((item) => item.id === rule.format)?.label || rule.format}</h2>
                <p>{ROLES.find((item) => item.id === rule.playerRole)?.label || rule.playerRole}</p>
                <p className="muted">
                  {RESULTS.find((item) => item.id === rule.gameResult)?.label || rule.gameResult} · {rule.points}
                  {!rule.isActive ? ' · выкл.' : ''}
                </p>
              </div>
              <div className="catalog-tile__actions">
                <button type="button" className="btn-secondary btn-s" onClick={() => setEditor(rule)}>Изменить</button>
                <button type="button" className="btn-ghost btn-s" onClick={() => removeRule(rule)}>Удалить</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <RuleModal
          rule={editor === true ? null : editor}
          onClose={() => setEditor(null)}
          onSave={saveRule}
        />
      )}
    </section>
  )
}
