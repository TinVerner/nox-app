import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'
import TopNav from './components/TopNav'
import SideNav from './components/SideNav'
import HomeScreen from './screens/HomeScreen'
import GamesScreen from './screens/GamesScreen'
import RatingScreen from './screens/RatingScreen'
import NewsScreen from './screens/NewsScreen'
import UsersScreen from './screens/UsersScreen'
import LoginScreen from './screens/LoginScreen'
import RegisterScreen from './screens/RegisterScreen'
import MembersScreen from './screens/MembersScreen'
import BookingsScreen from './screens/BookingsScreen'
import ProfileScreen from './screens/ProfileScreen'
import ResultsScreen from './screens/ResultsScreen'
import SeasonsScreen from './screens/SeasonsScreen'
import OverviewScreen from './screens/OverviewScreen'
import SettingsScreen from './screens/SettingsScreen'

function shellFor(user) {
  if (!user) return 'guest'
  if (user.role === 'HOST') return 'host'
  if (user.role === 'ADMIN') return 'admin'
  return 'player'
}

function App() {
  const [me, setMe] = useState(null)
  const [screen, setScreen] = useState('home')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [nick, setNick] = useState('')
  const [error, setError] = useState('')
  const [news, setNews] = useState([])
  const [games, setGames] = useState([])
  const [gamesReload, setGamesReload] = useState(0)
  const [rating, setRating] = useState([])
  const shell = shellFor(me)
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    apiFetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (!me) return
    setScreen((current) => {
      if (current !== 'home') return current
      return me.role === 'ADMIN' ? 'overview' : 'games'
    })
  }, [me])

  useEffect(() => {
    if (screen !== 'news') return
    apiFetch('/api/news').then((r) => r.json()).then(setNews)
  }, [screen])

  useEffect(() => {
    if (screen !== 'games') return
    apiFetch('/api/games').then((r) => r.json()).then(setGames)
  }, [screen, gamesReload])

  useEffect(() => {
    let socket
    try {
      socket = new WebSocket('ws://localhost:3000/ws')
      socket.onmessage = (event) => {
        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          return
        }
        if (data?.type !== 'games') return
        const current = screenRef.current
        if (current !== 'games' && current !== 'home') return
        setGamesReload((n) => n + 1)
      }
    } catch {
      return
    }
    return () => {
      try {
        socket.close()
      } catch {
        // the schedule still loads through the normal fetch
      }
    }
  }, [])

  useEffect(() => {
    if (screen !== 'rating') return
    apiFetch('/api/rating').then((r) => r.json()).then(setRating)
  }, [screen])

  async function login(e) {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Заполни поля')
      return
    }
    const res = await apiFetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'ошибка')
    setMe(data)
    setScreen(data.role === 'ADMIN' ? 'overview' : 'games')
  }

  async function register(e) {
    e.preventDefault()
    setError('')
    if (!nick.trim() || !email.trim() || !password.trim() || !passwordAgain.trim()) {
      setError('Заполни поля')
      return
    }
    if (password !== passwordAgain) {
      setError('Пароли не совпали')
      return
    }
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
    const data = await res.json().catch(() => ({}))
    alert(res.ok ? 'ты записана' : (data.error || 'не вышло'))
  }

  async function setGameStatus(id, status) {
    const res = await apiFetch('/api/games/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return alert('не вышло')
    const updated = await res.json()
    setGames(games.map((game) => (game.id === id ? updated : game)))
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
    <div className={shell === 'guest' ? 'app-shell app-shell--guest' : 'app-shell app-shell--side'}>
      {shell === 'guest' ? (
        <TopNav screen={screen} setScreen={setScreen} />
      ) : (
        <SideNav role={shell} screen={screen} setScreen={setScreen} logout={logout} />
      )}

      <main className="app-main">
        {screen === 'home' && (
          <HomeScreen onOpenSchedule={() => setScreen('games')} reloadKey={gamesReload} />
        )}
        {screen === 'games' && (
          <GamesScreen
            me={me}
            games={games}
            reloadKey={gamesReload}
            onBook={book}
            onCreate={createGame}
            onLogin={() => setScreen('login')}
            onStatus={setGameStatus}
          />
        )}
        {screen === 'rating' && <RatingScreen rating={rating} />}
        {screen === 'news' && <NewsScreen me={me} news={news} onCreate={createNews} />}
        {screen === 'users' && <UsersScreen />}
        {screen === 'members' && <MembersScreen />}
        {screen === 'bookings' && <BookingsScreen />}
        {screen === 'profile' && <ProfileScreen me={me} />}
        {screen === 'results' && <ResultsScreen />}
        {screen === 'seasons' && <SeasonsScreen />}
        {screen === 'overview' && <OverviewScreen setScreen={setScreen} />}
        {screen === 'settings' && <SettingsScreen />}
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
            passwordAgain={passwordAgain}
            error={error}
            setEmail={setEmail}
            setNick={setNick}
            setPassword={setPassword}
            setPasswordAgain={setPasswordAgain}
            onSubmit={register}
          />
        )}
      </main>
    </div>
  )
}

export default App
