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

  useEffect(() => {
    fetch(api + '/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (screen !== 'news') return
    fetch(api + '/api/news')
      .then((r) => r.json())
      .then(setNews)
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

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#eee', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #2a2a2a' }}>
        <b style={{ color: '#C9A84C', fontSize: 24, cursor: 'pointer' }} onClick={() => setScreen('home')}>NOX</b>
        <nav style={{ display: 'flex', gap: 16 }}>
          <span>Игры</span>
          <span>Рейтинг</span>
          <span onClick={() => setScreen('news')} style={{ cursor: 'pointer' }}>Новости</span>
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

        {screen === 'news' && (
          <>
            <h1 style={{ color: '#C9A84C' }}>Новости</h1>
            {news.map((item) => (
              <article key={item.id}>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </article>
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