import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function ResultsScreen() {
  const [games, setGames] = useState([])
  const [gameId, setGameId] = useState('')
  const [nick, setNick] = useState('')
  const [points, setPoints] = useState('')
  const [results, setResults] = useState([])

  useEffect(() => {
    apiFetch('/api/games')
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        setGames(items)
        if (items[0]) setGameId(items[0].id)
      })
      .catch(() => setGames([]))
  }, [])

  useEffect(() => {
    if (!gameId) return
    apiFetch('/api/results?gameId=' + encodeURIComponent(gameId))
      .then((r) => (r.ok ? r.json() : []))
      .then(setResults)
      .catch(() => setResults([]))
  }, [gameId])

  async function add(e) {
    e.preventDefault()
    const res = await apiFetch('/api/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, nick, points }),
    })
    if (!res.ok) return alert('не вышло')
    const row = await res.json()
    setResults((rows) => [row, ...rows])
    setNick('')
    setPoints('')
  }

  return (
    <section className="screen">
      <h1>Результаты</h1>
      <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
        {games.map((game) => (
          <option key={game.id} value={game.id}>{game.title}</option>
        ))}
      </select>
      <form onSubmit={add}>
        <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} required />
        <input placeholder="очки" type="number" value={points} onChange={(e) => setPoints(e.target.value)} required />
        <button>Добавить</button>
      </form>
      {results.map((row) => (
        <p key={row.id}>{row.nick}: {row.points}</p>
      ))}
    </section>
  )
}
