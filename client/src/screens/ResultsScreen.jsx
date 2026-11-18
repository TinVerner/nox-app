import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const ROLES = ['Мирный', 'Мафия', 'Шериф', 'Дон']
const RESULTS = ['Победа', 'Поражение']

export default function ResultsScreen() {
  const [games, setGames] = useState([])
  const [gameId, setGameId] = useState('')
  const [parties, setParties] = useState([])
  const [partyId, setPartyId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [playerRole, setPlayerRole] = useState(ROLES[0])
  const [gameResult, setGameResult] = useState(RESULTS[0])
  const [extraPoints, setExtraPoints] = useState('0')
  const [penaltyPoints, setPenaltyPoints] = useState('0')
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/games')
      .then((response) => (response.ok ? response.json() : []))
      .then((items) => {
        setGames(items)
        if (items[0]) setGameId(String(items[0].id))
      })
      .catch(() => setGames([]))
  }, [])

  useEffect(() => {
    if (!gameId) return
    apiFetch('/api/games/' + gameId + '/parties')
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        setParties(rows)
        setPartyId((current) => current || (rows[0] ? String(rows[0].id) : ''))
      })
      .catch(() => setParties([]))
  }, [gameId])

  const party = parties.find((item) => String(item.id) === String(partyId))

  async function addParty() {
    setError('')
    const res = await apiFetch('/api/games/' + gameId + '/parties', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'не вышло')
    setParties((rows) => [...rows, data])
    setPartyId(String(data.id))
  }

  async function addPlayer(event) {
    event.preventDefault()
    setError('')
    const res = await apiFetch('/api/parties/' + partyId + '/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerName,
        playerRole,
        gameResult,
        extraPoints: Number(extraPoints),
        penaltyPoints: Number(penaltyPoints),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.error || 'не вышло')
    setParties((rows) => rows.map((item) => (
      String(item.id) === String(partyId) ? { ...item, players: [...item.players, data] } : item
    )))
    setPlayerName('')
    setExtraPoints('0')
    setPenaltyPoints('0')
  }

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Ведущий</p>
          <h1>Партии вечера</h1>
        </div>
        <button type="button" className="btn-primary" disabled={!gameId} onClick={addParty}>Новая партия</button>
      </div>
      <div className="toolbar">
        <select value={gameId} onChange={(event) => { setGameId(event.target.value); setPartyId('') }}>
          {games.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
        <select value={partyId} onChange={(event) => setPartyId(event.target.value)}>
          {parties.map((item) => (
            <option key={item.id} value={item.id}>Партия {item.partyNumber}</option>
          ))}
        </select>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {!party ? <p className="muted">пусто</p> : (
        <>
          <form className="panel stack" onSubmit={addPlayer}>
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="имя игрока" required />
            <select value={playerRole} onChange={(event) => setPlayerRole(event.target.value)}>
              {ROLES.map((role) => <option key={role}>{role}</option>)}
            </select>
            <select value={gameResult} onChange={(event) => setGameResult(event.target.value)}>
              {RESULTS.map((result) => <option key={result}>{result}</option>)}
            </select>
            <input type="number" step="0.5" value={extraPoints} onChange={(event) => setExtraPoints(event.target.value)} placeholder="дополнительные очки" />
            <input type="number" step="0.5" value={penaltyPoints} onChange={(event) => setPenaltyPoints(event.target.value)} placeholder="штраф" />
            <button type="submit" className="btn-primary">Добавить в партию</button>
          </form>
          {party.players.length === 0 ? <p className="muted">пусто</p> : (
            <div className="stack">
              {party.players.map((player) => (
                <article key={player.id} className="panel">
                  <h2>{player.playerName}</h2>
                  <p>{player.playerRole} · {player.gameResult}</p>
                  <p className="muted">база {player.basePoints} · доп. {player.extraPoints} · штраф {player.penaltyPoints} · итог {player.total}</p>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}
