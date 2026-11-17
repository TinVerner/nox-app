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

  const game = games.find((item) => item.id === gameId)

  return (
    <section className="screen">
      <p className="eyebrow">Результаты</p>
      <h1>{game ? game.title : 'Результаты вечеров'}</h1>
      {game?.startsAt && <p className="muted">{new Date(game.startsAt).toLocaleString('ru')}{game.place ? ` · ${game.place}` : ''}</p>}
      <div className="toolbar">
        <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
          {games.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </div>
      <form className="panel stack" onSubmit={add}>
        <div className="form-row">
          <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} required />
          <input placeholder="очки" type="number" value={points} onChange={(e) => setPoints(e.target.value)} required />
          <button type="submit">Добавить</button>
        </div>
        <div className="toolbar">
          {results.map((row) => (
            <span key={row.id} className="chip">{row.nick} · {row.points}</span>
          ))}
        </div>
      </form>
    </section>
  )
}
