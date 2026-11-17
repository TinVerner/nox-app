import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

export default function ResultsScreen() {
  const [games, setGames] = useState([])
  const [gameId, setGameId] = useState('')
  const [nick, setNick] = useState('')
  const [points, setPoints] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

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

  async function add(event) {
    event.preventDefault()
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
    setOpen(false)
  }

  const game = games.find((item) => item.id === gameId)
  const finished = game?.status === 'DONE'
  const standings = finished
    ? [...results].sort((a, b) => (b.points - a.points) || String(a.nick).localeCompare(String(b.nick), 'ru'))
    : results

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Результаты</p>
          <h1>{game ? game.title : 'Результаты вечеров'}</h1>
          {game?.startsAt && <p className="muted">{new Date(game.startsAt).toLocaleString('ru')}{game.place ? ` · ${game.place}` : ''}</p>}
        </div>
        <button type="button" className="btn-primary" disabled={!gameId} onClick={() => setOpen(true)}>Добавить</button>
      </div>
      <div className="toolbar">
        <select value={gameId} onChange={(event) => setGameId(event.target.value)}>
          {games.map((item) => (
            <option key={item.id} value={item.id}>{item.title}</option>
          ))}
        </select>
      </div>
      {finished ? (
        <div className="panel">
          <h2>Итоги вечера</h2>
          <ol className="standings">
            {standings.map((row, index) => (
              <li key={row.id}>
                <span className="muted">{index + 1}</span>
                <span>{row.nick}</span>
                <span>{row.points}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="toolbar">
          {results.map((row) => (
            <span key={row.id} className="chip">{row.nick} · {row.points}</span>
          ))}
        </div>
      )}
      {open && (
        <Modal title="Результат" eyebrow={game?.title || 'Вечер'} onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={add}>
            <input placeholder="ник" value={nick} onChange={(event) => setNick(event.target.value)} required />
            <input placeholder="очки" type="number" value={points} onChange={(event) => setPoints(event.target.value)} required />
            <div className="modal-actions">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Отмена</button>
              <button type="submit">Добавить</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  )
}
