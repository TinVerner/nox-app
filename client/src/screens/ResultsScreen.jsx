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

export default function ResultsScreen({ gameId, onBack }) {
  const [sheet, setSheet] = useState(null)
  const [parties, setParties] = useState([])
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!gameId) return undefined
    let cancelled = false
    apiFetch('/api/games/' + gameId + '/results')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setSheet(data)
        const booked = new Set((data.roster || []).filter((person) => person.kind === 'PLAYER' && person.userId).map((person) => person.userId))
        const canEdit = data.started === true && data.held === true
        setParties(canEdit ? (data.parties || []).map((party) => ({
          ...party,
          players: (party.players || []).filter((player) => player.userId && booked.has(player.userId) && player.kind !== 'GUEST'),
        })) : [])
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

  function removeParty(index) {
    setParties((list) => list.filter((_, partyIndex) => partyIndex !== index))
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
      setSheet(data)
      const booked = new Set((data.roster || []).filter((person) => person.kind === 'PLAYER' && person.userId).map((person) => person.userId))
      const canEdit = data.started === true && data.held === true
      setParties(canEdit ? (data.parties || []).map((party) => ({
        ...party,
        players: (party.players || []).filter((player) => player.userId && booked.has(player.userId) && player.kind !== 'GUEST'),
      })) : [])
      setNote(mode === 'publish' ? 'Результаты опубликованы' : 'Черновик сохранён')
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
      {held ? (
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
                  <button type="button" className="btn-ghost btn-s" onClick={() => removeParty(index)}>Убрать партию</button>
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
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.25"
                              aria-label={`Дополнительные очки, ${row.label}, партия ${partyIndex + 1}`}
                              value={player.extraPoints}
                              onChange={(event) => updateCell(partyIndex, row.key, { extraPoints: event.target.value })}
                            />
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
      {held ? (
      <div className="result-actions">
        <button type="button" className="btn-secondary" onClick={addParty}>Ещё партия</button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => save('draft')}>Сохранить черновик</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => save('publish')}>Опубликовать результаты</button>
      </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {note ? <p className="muted">{note}</p> : null}
    </section>
  )
}
