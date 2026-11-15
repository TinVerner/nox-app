import { useEffect, useState } from 'react'
import { apiFetch } from './api'
import Header from './components/Header'
import HomeScreen from './screens/HomeScreen'
import GamesScreen from './screens/GamesScreen'
import RatingScreen from './screens/RatingScreen'
import NewsScreen from './screens/NewsScreen'
import UsersScreen from './screens/UsersScreen'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'

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
    apiFetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (screen !== 'news') return
    apiFetch('/api/news').then((r) => r.json()).then(setNews)
  }, [screen])

  useEffect(() => {
    if (screen !== 'games') return
    apiFetch('/api/games').then((r) => r.json()).then(setGames)
  }, [screen])

  useEffect(() => {
    if (screen !== 'rating') return
    apiFetch('/api/rating').then((r) => r.json()).then(setRating)
  }, [screen])

  useEffect(() => {
    if (screen !== 'users') return
    apiFetch('/api/users')
      .then((r) => r.json())
      .then(setUsers)
  }, [screen])

  async function login(e) {
    e.preventDefault()
    setError('')
    const res = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await apiFetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nick }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'ошибка')
    setScreen('login')
  }

  async function logout() {
    await apiFetch('/api/logout', { method: 'POST' })
    setMe(null)
    setScreen('home')
  }

  async function book(gameId) {
    const res = await apiFetch('/api/games/' + gameId + '/book', {
      method: 'POST',
    })
    alert(res.ok ? 'ты записана' : 'не вышло')
  }

  async function setRole(id, role) {
    const res = await apiFetch('/api/users/' + id + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const updated = await res.json()
    if (!res.ok) return alert(updated.error || 'не вышло')
    setUsers(users.map((u) => (u.id === id ? updated : u)))
  }

  async function createGame(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    const res = await apiFetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  }

  async function createNews(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    const res = await apiFetch('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: form.get('title'), body: form.get('body') }),
    })
    if (!res.ok) return alert('не вышло')
    setNews([await res.json(), ...news])
    e.target.reset()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#eee', fontFamily: 'sans-serif' }}>
      <Header me={me} setScreen={setScreen} logout={logout} />

      <main style={{ padding: 40 }}>
        {screen === 'home' && <HomeScreen />}
        {screen === 'games' && (
          <GamesScreen me={me} games={games} onBook={book} onCreate={createGame} />
        )}
        {screen === 'rating' && <RatingScreen rating={rating} />}
        {screen === 'news' && <NewsScreen me={me} news={news} onCreate={createNews} />}
        {screen === 'users' && <UsersScreen users={users} onSetRole={setRole} />}
        {screen === 'login' && (
          <LoginScreen
            email={email}
            password={password}
            error={error}
            setEmail={setEmail}
            setPassword={setPassword}
            onSubmit={login}
          />
        )}
        {screen === 'register' && (
          <RegisterScreen
            email={email}
            nick={nick}
            password={password}
            error={error}
            setEmail={setEmail}
            setNick={setNick}
            setPassword={setPassword}
            onSubmit={register}
          />
        )}
      </main>
    </div>
  )
}

export default App
