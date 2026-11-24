import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const MIN_PLAYERS = 8
const ROLES = [
  { id: 'CIVILIAN', label: 'мирный' },
  { id: 'SHERIFF', label: 'шериф' },
  { id: 'MAFIA', label: 'мафия' },
  { id: 'DON', label: 'дон' },
]
const SIDES = [
  { id: 'CITY', label: 'мирный город' },
  { id: 'MAFIA', label: 'мафия' },
]

const ROLE_LABEL = Object.fromEntries(ROLES.map((role) => [role.id, role.label]))
const SIDE_LABEL = Object.fromEntries(SIDES.map((side) => [side.id, side.label]))

function show(value) {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : '0'
}

function round2(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round((number + Number.EPSILON) * 100) / 100
}

function personKey(player) {
  if (player?.userId) return `user:${player.userId}`
  if (player?.guestId) return `guest:${player.guestId}`
  if (player?.id) return `row:${player.id}`
  return ''
}

function freshPlayer(person) {
  return {
    id: null,
    userId: person.userId || null,
    guestId: person.guestId || null,
    kind: person.kind,
    label: person.label,
    attendance: 'PRESENT',
    role: '',
    extraPoints: 0,
    note: '',
    basePoints: 0,
    total: 0,
  }
}

function tableRows(roster) {
  const rows = []
  const seen = new Set()
  for (const person of roster || []) {
    if (person.kind !== 'PLAYER' || !person.userId) continue
    const key = personKey(person)
    if (!key || seen.has(key)) continue
    seen.add(key)
    rows.push({
      key,
      userId: person.userId,
      guestId: null,
      kind: 'PLAYER',
      label: person.label,
    })
  }
  return rows
}

function cellScore(player) {
  if (!player || player.attendance === 'SKIPPED') return { base: 0, total: 0 }
  return { base: round2(player.basePoints), total: round2(player.total) }
}

function partiesPublished(list) {
  if (!list?.length) return false
  return list.every((party) => party.status === 'PUBLISHED' || party.status === 'DONE')
}

function rankedTotals(list) {
  return [...(list || [])]
    .sort((a, b) => Number(b.total) - Number(a.total))
    .map((row, index) => ({ ...row, place: index + 1 }))
}

function applySheet(data, setSheet, setParties) {
  setSheet(data)
  const booked = new Set((data.roster || []).filter((person) => person.kind === 'PLAYER' && person.userId).map((person) => person.userId))
  const canEdit = data.started === true && data.held === true
  setParties(canEdit ? (data.parties || []).map((party) => ({
    ...party,
    players: (party.players || []).filter((player) => player.userId && booked.has(player.userId) && player.kind !== 'GUEST'),
  })) : [])
}

export default function ResultsScreen({ gameId, onBack, onPublished }) {
  const [sheet, setSheet] = useState(null)
  const [parties, setParties] = useState([])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [partiesOpen, setPartiesOpen] = useState(false)

  useEffect(() => {
    if (!gameId) return undefined
    let cancelled = false
    setEditing(false)
    setPartiesOpen(false)
    setError('')
    setNote('')
    apiFetch('/api/games/' + gameId + '/results')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        applySheet(data, setSheet, setParties)
        const held = data.started === true && data.held === true
        const published = held && data.persisted && partiesPublished(data.parties)
        setEditing(!published)
      })
      .catch(() => {
        if (!cancelled) setError('не вышло')
      })
    return () => {
      cancelled = true
    }
  }, [gameId])

  const rosterRows = tableRows(sheet?.roster)
  const confirmedCount = Number.isInteger(sheet?.confirmedCount) ? sheet.confirmedCount : rosterRows.length
  const started = sheet?.started === true
  const notStarted = sheet != null && sheet.started === false
  const failed = started && sheet?.held === false
  const held = started && sheet?.held === true
  const rows = held ? rosterRows : []
  const published = held && sheet?.persisted && partiesPublished(parties)
  const viewOnly = held && published && !editing
  // По ответу сервера, а не по локальным партиям: новая несохранённая партия не делает вечер черновиком.
  const serverPublished = held && sheet?.persisted && partiesPublished(sheet?.parties)

  function updateParty(index, patch) {
    setParties((list) => list.map((party, partyIndex) => (partyIndex === index ? { ...party, ...patch } : party)))
  }

  function updateCell(partyIndex, key, patch) {
    setParties((list) => list.map((party, index) => {
      if (index !== partyIndex) return party
      return {
        ...party,
        players: party.players.map((player) => (personKey(player) === key ? { ...player, ...patch } : player)),
      }
    }))
  }

  function addParty() {
    if (!rows.length) return
    setParties((list) => [...list, {
      id: null,
      partyNumber: list.length + 1,
      status: 'DRAFT',
      winningSide: '',
      players: rows.map(freshPlayer),
    }])
  }

  async function removeParty(index) {
    const party = parties[index]
    if (!party) return
    if (!party.id) {
      setParties((list) => list.filter((_, partyIndex) => partyIndex !== index))
      return
    }
    if (!window.confirm(`Удалить партию ${index + 1}? Очки игроков из неё пропадут из рейтинга после удаления.`)) return
    setBusy(true)
    setError('')
    setNote('')
    try {
      const response = await apiFetch('/api/games/' + gameId + '/parties/' + party.id, { method: 'DELETE' })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'не вышло')
        return
      }
      applySheet(data, setSheet, setParties)
      setNote('Партия удалена')
      if (!partiesPublished(data.parties || [])) setEditing(true)
    } catch {
      setError('не вышло')
    } finally {
      setBusy(false)
    }
  }

  function addToParty(partyIndex, row) {
    setParties((list) => list.map((party, index) => {
      if (index !== partyIndex) return party
      if (party.players.some((player) => personKey(player) === row.key)) return party
      return { ...party, players: [...party.players, freshPlayer(row)] }
    }))
  }

  function removeFromParty(partyIndex, key) {
    setParties((list) => list.map((party, index) => {
      if (index !== partyIndex) return party
      return { ...party, players: party.players.filter((player) => personKey(player) !== key) }
    }))
  }

  function nightTotal(key) {
    return round2(parties.reduce((sum, party) => {
      const player = party.players.find((item) => personKey(item) === key)
      return sum + cellScore(player).total
    }, 0))
  }

  async function save(mode) {
    if (busy || !gameId || !held) return
    setBusy(true)
    setError('')
    setNote('')
    try {
      const response = await apiFetch('/api/games/' + gameId + '/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          parties: parties.map((party) => ({
            id: party.id,
            winningSide: party.winningSide,
            players: party.players.map((player) => ({
              id: player.id,
              userId: player.userId,
              guestId: player.guestId,
              attendance: player.attendance,
              role: player.role,
              extraPoints: player.extraPoints,
              note: player.note,
            })),
          })),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error || 'не вышло')
        return
      }
      applySheet(data, setSheet, setParties)
      if (mode === 'publish') {
        setNote('Результаты опубликованы')
        setEditing(false)
        onPublished?.()
        return
      }
      setNote('Черновик сохранён')
      setEditing(true)
    } catch {
      setError('не вышло')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Вечера</p>
          <h1>Результаты игрового вечера</h1>
          {sheet?.night?.title ? <p className="lede">{sheet.night.title}</p> : null}
        </div>
        <button type="button" className="btn-ghost" onClick={onBack}>К вечерам</button>
      </div>
      {!gameId ? <p className="muted">Выберите вечер</p> : null}
      {gameId && notStarted ? (
        <div className="panel stack">
          <h2>Вечер ещё не начался</h2>
          <p>Запись ещё открыта. Результаты можно заполнять после начала вечера.</p>
          <p>Подтверждено пока: {confirmedCount} из {MIN_PLAYERS}</p>
        </div>
      ) : null}
      {gameId && failed ? (
        <div className="panel stack">
          <h2>Вечер не состоялся</h2>
          <p>Игры не проводились: на вечер записалось меньше 8 игроков. Гости не считаются.</p>
          <p>Подтверждено: {confirmedCount} из {MIN_PLAYERS}</p>
        </div>
      ) : null}
      {viewOnly ? (
        <div className="stack">
          <div className="result-actions">
            <button type="button" className="btn-primary" onClick={() => { setEditing(true); setNote(''); setPartiesOpen(false) }}>Изменить</button>
            <button type="button" className="btn-ghost" onClick={onBack}>К вечерам</button>
          </div>
          <section className="night-rank">
            <h2 className="night-rank__title">Рейтинг вечера</h2>
            <table className="night-rank__table">
              <thead>
                <tr>
                  <th scope="col">Место</th>
                  <th scope="col">Игрок</th>
                  <th scope="col">Очки</th>
                </tr>
              </thead>
              <tbody>
                {rankedTotals(sheet?.totals).map((row) => (
                  <tr key={row.key || row.label}>
                    <td className="night-rank__place">{row.place}</td>
                    <td className="night-rank__nick">{row.label}</td>
                    <td className="night-rank__pts">{show(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sheet?.totals?.length ? <p className="muted">нет очков за вечер</p> : null}
          </section>
          <div className="result-actions">
            <button
              type="button"
              className="btn-secondary"
              aria-expanded={partiesOpen}
              onClick={() => setPartiesOpen((open) => !open)}
            >
              {partiesOpen ? 'Скрыть' : 'Подробнее'}
            </button>
          </div>
          {partiesOpen ? (
            <div className="played-detail">
              {parties.map((party, index) => (
                <section key={party.id || index} className="played-party">
                  <header className="played-party__head">
                    <h3>Партия {index + 1}</h3>
                    <p className="played-party__side">
                      победа: {SIDE_LABEL[party.winningSide] || party.winningSide || '—'}
                    </p>
                  </header>
                  <ul className="played-players">
                    {(party.players || []).map((player) => (
                      <li key={player.id || `${party.id}-${player.label}`}>
                        <span className="played-players__nick">{player.label}</span>
                        <span className="played-players__role">
                          {player.attendance === 'SKIPPED' ? 'пропустил' : (ROLE_LABEL[player.role] || player.role || '—')}
                        </span>
                        <span className="played-players__pts">{show(cellScore(player).total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {held && editing ? (
      <div className="result-table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              <th />
              {parties.map((party, index) => (
                <th key={party.id || `side-${index}`}>
                  <label className="result-side">
                    Сторона победы
                    <select value={party.winningSide || ''} onChange={(event) => updateParty(index, { winningSide: event.target.value })}>
                      <option value="">не выбрана</option>
                      {SIDES.map((side) => <option key={side.id} value={side.id}>{side.label}</option>)}
                    </select>
                  </label>
                </th>
              ))}
              <th />
            </tr>
            <tr>
              <th>Игрок</th>
              {parties.map((party, index) => (
                <th key={party.id || `party-${index}`}>
                  <span className="result-party-name">Партия {index + 1}</span>
                  <button type="button" className="btn-ghost btn-s" disabled={busy} onClick={() => removeParty(index)}>Удалить партию</button>
                </th>
              ))}
              <th>Вечер</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" className="result-nick">
                  {row.label}
                  {row.kind === 'GUEST' ? <span className="muted"> · гость</span> : null}
                </th>
                {parties.map((party, partyIndex) => {
                  const player = party.players.find((item) => personKey(item) === row.key)
                  const score = cellScore(player)
                  const roleValue = !player
                    ? ''
                    : player.attendance === 'SKIPPED'
                      ? 'SKIPPED'
                      : (ROLES.some((role) => role.id === player.role) ? player.role : '')
                  return (
                    <td key={`${row.key}-${party.id || partyIndex}`}>
                      {player ? (
                        <div className="result-cell">
                          <select
                            aria-label={`Роль, ${row.label}, партия ${partyIndex + 1}`}
                            value={roleValue}
                            onChange={(event) => {
                              const value = event.target.value
                              if (value === 'SKIPPED') updateCell(partyIndex, row.key, { attendance: 'SKIPPED' })
                              else updateCell(partyIndex, row.key, { attendance: 'PRESENT', role: value })
                            }}
                          >
                            <option value="">роль</option>
                            {ROLES.map((role) => <option key={role.id} value={role.id}>{role.label}</option>)}
                            <option value="SKIPPED">Пропустил</option>
                          </select>
                          {player.attendance === 'SKIPPED' ? null : (
                            <label className="result-extra">
                              <span className="result-extra-label">дополнительные баллы</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.25"
                                aria-label={`Дополнительные баллы, ${row.label}, партия ${partyIndex + 1}`}
                                value={player.extraPoints}
                                onChange={(event) => updateCell(partyIndex, row.key, { extraPoints: event.target.value })}
                              />
                            </label>
                          )}
                          <p className="muted">база {show(score.base)} · итог {show(score.total)}</p>
                          <button type="button" className="btn-ghost btn-s" onClick={() => removeFromParty(partyIndex, row.key)}>Убрать</button>
                        </div>
                      ) : row.userId || row.guestId ? (
                        <button type="button" className="btn-ghost btn-s" onClick={() => addToParty(partyIndex, row)}>В партию</button>
                      ) : (
                        <p className="muted">—</p>
                      )}
                    </td>
                  )
                })}
                <td className="result-total">{show(nightTotal(row.key))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}
      {held && editing ? (
      <div className="result-actions">
        <button type="button" className="btn-secondary" onClick={addParty}>Ещё партия</button>
        {/* Черновик снял бы уже опубликованные результаты из рейтинга и «Сыгранных». */}
        {serverPublished ? null : (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => save('draft')}>Сохранить черновик</button>
        )}
        <button type="button" className="btn-primary" disabled={busy} onClick={() => save('publish')}>Опубликовать результаты</button>
        {published ? (
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setEditing(false)}>Отмена правки</button>
        ) : null}
      </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {note ? <p className="muted">{note}</p> : null}
    </section>
  )
}
