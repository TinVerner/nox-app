import { useEffect, useState } from 'react'

const api = 'http://localhost:3000'

function App() {
  const [me, setMe] = useState(null)
  const [screen, setScreen] = useState('home')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nick, setNick] = useState('')
  const [error, setError] = useState('')
  const [news, setNews] = useState([])
  const [games, setGames] = useState([])
  const [rating, setRating] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    fetch(api + '/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (screen !== 'news') return
    fetch(api + '/api/news').then((r) => r.json()).then(setNews)
  }, [screen])

  useEffect(() => {
    if (screen !== 'games') return
    fetch(api + '/api/games').then((r) => r.json()).then(setGames)
  }, [screen])

  useEffect(() => {
    if (screen !== 'rating') return
    fetch(api + '/api/rating').then((r) => r.json()).then(setRating)
  }, [screen])

  useEffect(() => {
    if (screen !== 'users') return
    fetch(api + '/api/users', { credentials: 'include' })
      .then((r) => r.json())
      .then(setUsers)
  }, [screen])

  async function login(e) {
    e.preventDefault()
    setError('')
    const res = await fetch(api + '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'ошибка')
    setMe(data)
    setScreen('home')
  }

  async function register(e) {
    e.preventDefault()
    setError('')
    const res = await fetch(api + '/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nick }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'ошибка')
    setScreen('login')
  }

  async function logout() {
    await fetch(api + '/api/logout', { method: 'POST', credentials: 'include' })
    setMe(null)
    setScreen('home')
  }

  async function book(gameId) {
    const res = await fetch(api + '/api/games/' + gameId + '/book', {
      method: 'POST',
      credentials: 'include',
    })
    alert(res.ok ? 'ты записана' : 'не вышло')
  }

  async function setRole(id, role) {
    const res = await fetch(api + '/api/users/' + id + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ role }),
    })
    const updated = await res.json()
    if (!res.ok) return alert(updated.error || 'не вышло')
    setUsers(users.map((u) => (u.id === id ? updated : u)))
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#eee', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #2a2a2a' }}>
        <b style={{ color: '#C9A84C', fontSize: 24, cursor: 'pointer' }} onClick={() => setScreen('home')}>NOX</b>
        <nav style={{ display: 'flex', gap: 16 }}>
          <span onClick={() => setScreen('games')} style={{ cursor: 'pointer' }}>Игры</span>
          <span onClick={() => setScreen('rating')} style={{ cursor: 'pointer' }}>Рейтинг</span>
          <span onClick={() => setScreen('news')} style={{ cursor: 'pointer' }}>Новости</span>
          {me?.role === 'ADMIN' && (
            <span onClick={() => setScreen('users')} style={{ cursor: 'pointer' }}>Люди</span>
          )}
        </nav>
        {me ? (
          <div>
            {me.nick} · {me.role}{' '}
            <button onClick={logout}>Выйти</button>
          </div>
        ) : (
          <div>
            <button onClick={() => setScreen('login')}>Войти</button>{' '}
            <button onClick={() => setScreen('register')}>Регистрация</button>
          </div>
        )}
      </header>

      <main style={{ padding: 40 }}>
        {screen === 'home' && (
          <>
            <h1 style={{ color: '#C9A84C' }}>Клуб интеллектуальной игры «Мафия»</h1>
            <p>Запишись на игру, смотри рейтинг и новости клуба.</p>
          </>
        )}

        {screen === 'games' && (
          <>
            <h1 style={{ color: '#C9A84C' }}>Игры</h1>
            {(me?.role === 'HOST' || me?.role === 'ADMIN') && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                const form = new FormData(e.target)
                const res = await fetch(api + '/api/games', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    title: form.get('title'),
                    startsAt: form.get('startsAt'),
                    place: form.get('place'),
                    seats: form.get('seats'),
                  }),
                })
                if (!res.ok) return alert('не вышло')
                setGames([await res.json(), ...games])
                e.target.reset()
              }}>
                <input name="title" placeholder="название" required />
                <input name="startsAt" type="datetime-local" required />
                <input name="place" placeholder="место" required />
                <input name="seats" type="number" placeholder="мест" required />
                <button>Создать игру</button>
              </form>
            )}
            {games.map((game) => (
              <article key={game.id}>
                <h2>{game.title}</h2>
                <p>{new Date(game.startsAt).toLocaleString('ru')} · {game.place} · мест: {game.seats}</p>
                {me && <button onClick={() => book(game.id)}>Записаться</button>}
              </article>
            ))}
          </>
        )}

        {screen === 'rating' && (
          <>
            <h1 style={{ color: '#C9A84C' }}>Рейтинг</h1>
            <ol>
              {rating.map((row) => (
                <li key={row.id}>{row.nick}: {row.points} очков, игр {row.games}</li>
              ))}
            </ol>
          </>
        )}

        {screen === 'news' && (
          <>
            <h1 style={{ color: '#C9A84C' }}>Новости</h1>
            {me?.role === 'ADMIN' && (
              <form onSubmit={async (e) => {
                e.preventDefault()
                const form = new FormData(e.target)
                const res = await fetch(api + '/api/news', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ title: form.get('title'), body: form.get('body') }),
                })
                if (!res.ok) return alert('не вышло')
                setNews([await res.json(), ...news])
                e.target.reset()
              }}>
                <input name="title" placeholder="заголовок" required />
                <input name="body" placeholder="текст" required />
                <button>Опубликовать</button>
              </form>
            )}
            {news.map((item) => (
              <article key={item.id}>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </article>
            ))}
          </>
        )}

        {screen === 'users' && (
          <>
            <h1 style={{ color: '#C9A84C' }}>Люди</h1>
            {users.map((user) => (
              <p key={user.id}>
                {user.nick} · {user.email} · {user.role}{' '}
                <button onClick={() => setRole(user.id, 'PLAYER')}>PLAYER</button>{' '}
                <button onClick={() => setRole(user.id, 'HOST')}>HOST</button>{' '}
                <button onClick={() => setRole(user.id, 'ADMIN')}>ADMIN</button>
              </p>
            ))}
          </>
        )}

        {screen === 'login' && (
          <form onSubmit={login}>
            <h2>Вход</h2>
            <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">Войти</button>
            {error && <p>{error}</p>}
          </form>
        )}

        {screen === 'register' && (
          <form onSubmit={register}>
            <h2>Регистрация</h2>
            <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} />
            <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">Создать</button>
            {error && <p>{error}</p>}
          </form>
        )}
      </main>
    </div>
  )
}

export default App