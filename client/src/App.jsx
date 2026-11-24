import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api'
import { useSession } from './hooks/useSession'
import { useGamesSocket } from './hooks/useGamesSocket'
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
import MemberScreen from './screens/MemberScreen'
import PlayersScreen from './screens/PlayersScreen'
import BookingsScreen from './screens/BookingsScreen'
import ProfileScreen from './screens/ProfileScreen'
import ResultsScreen from './screens/ResultsScreen'
import SeasonsScreen from './screens/SeasonsScreen'
import OverviewScreen from './screens/OverviewScreen'
import NotFoundScreen from './screens/NotFoundScreen'
import SanctionsScreen from './screens/SanctionsScreen'
import PointRulesScreen from './screens/PointRulesScreen'
import NoticesScreen from './screens/NoticesScreen'
import RanksScreen from './screens/RanksScreen'
import AboutScreen from './screens/AboutScreen'
import CatalogScreen from './screens/CatalogScreen'
import EventsScreen from './screens/EventsScreen'
import ExcelScreen from './screens/ExcelScreen'
import Footer from './components/Footer'

const KNOWN_SCREENS = new Set([
  'home', 'games', 'rating', 'news', 'users', 'members', 'players', 'member',
  'bookings', 'profile', 'results', 'seasons', 'overview', 'login', 'register',
  'sanctions', 'points', 'notices', 'ranks', 'about', 'catalog', 'events',
  'excel',
])

function shellFor(user) {
  if (!user) return 'guest'
  if (user.role === 'HOST') return 'host'
  if (user.role === 'ADMIN') return 'admin'
  return 'player'
}

function passwordMeetsRules(password) {
  return (
    password.length >= 8 &&
    /\d/.test(password) &&
    /[A-ZА-ЯЁ]/.test(password) &&
    /[^0-9A-Za-zА-Яа-яЁё]/.test(password)
  )
}

function App() {
  const { me, setMe, logout: endSession } = useSession()
  const [screen, setScreen] = useState('home')
  const [memberId, setMemberId] = useState(null)
  const [resultsNightId, setResultsNightId] = useState(null)
  const [memberBack, setMemberBack] = useState('members')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordAgain, setPasswordAgain] = useState('')
  const [nick, setNick] = useState('')
  const [error, setError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const authLock = useRef(false)
  const [news, setNews] = useState([])
  const [games, setGames] = useState([])
  const [rating, setRating] = useState([])
  const { gamesReload, notice, setNotice } = useGamesSocket(screen)
  const shell = shellFor(me)
  const previousScreen = useRef('home')

  function openScreen(next) {
    setScreen((current) => {
      if (KNOWN_SCREENS.has(current) && current !== next) previousScreen.current = current
      return next
    })
  }

  function go(next) {
    const path = window.location.pathname
    if (window.location.hash || (path !== '/' && path !== '')) {
      window.history.replaceState(null, '', '/' + window.location.search)
    }
    openScreen(next)
  }

  function roleHome() {
    if (!me) return 'home'
    if (me.role === 'ADMIN') return 'overview'
    return 'games'
  }

  useEffect(() => {
    function fromLocation() {
      const path = decodeURIComponent(window.location.pathname).replace(/\/+$/, '') || '/'
      if (path !== '/' && path !== '/index.html') {
        const parts = path.split('/').filter(Boolean)
        if (parts.length === 1 && KNOWN_SCREENS.has(parts[0])) openScreen(parts[0])
        else openScreen('not-found')
        return
      }
      const name = decodeURIComponent(window.location.hash.replace(/^#/, ''))
      if (name === 'upcoming' || name === '/upcoming') {
        openScreen('games')
        return
      }
      if (!name || KNOWN_SCREENS.has(name)) return
      openScreen(name)
    }
    fromLocation()
    window.addEventListener('hashchange', fromLocation)
    window.addEventListener('popstate', fromLocation)
    return () => {
      window.removeEventListener('hashchange', fromLocation)
      window.removeEventListener('popstate', fromLocation)
    }
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
    if (screen !== 'rating') return
    apiFetch('/api/rating').then((r) => r.json()).then(setRating)
  }, [screen])

  async function login(e) {
    e.preventDefault()
    if (authLock.current) return
    setError('')
    if (!email.trim() || !password.trim()) {
      setError('Заполни поля')
      return
    }
    authLock.current = true
    setAuthBusy(true)
    try {
      const res = await apiFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'ошибка')
        return
      }
      setMe(data)
      go(data.role === 'ADMIN' ? 'overview' : 'games')
    } finally {
      authLock.current = false
      setAuthBusy(false)
    }
  }

  async function register(e) {
    e.preventDefault()
    if (authLock.current) return
    setError('')
    if (!nick.trim() || !email.trim() || !password.trim() || !passwordAgain.trim()) {
      setError('Заполни поля')
      return
    }
    if (password !== passwordAgain) {
      setError('Пароли не совпали')
      return
    }
    if (!passwordMeetsRules(password)) {
      setError('Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол')
      return
    }
    authLock.current = true
    setAuthBusy(true)
    try {
      const res = await apiFetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nick }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'ошибка')
        return
      }
      go('login')
    } finally {
      authLock.current = false
      setAuthBusy(false)
    }
  }

  async function logout() {
    await endSession()
    setNotice('')
    go('home')
  }

  async function book(gameId) {
    const res = await apiFetch('/api/games/' + gameId + '/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'не вышло' }
    return { ok: true, id: data.id }
  }

  async function createGame(payload) {
    const res = await apiFetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || 'не вышло')
      return false
    }
    setGames([data, ...games])
    return true
  }

  async function cancelNight(id) {
    const res = await apiFetch('/api/games/' + id + '/cancel', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: data.error || 'не вышло' }
    setGames((list) => (list || []).map((game) => (game.id === id ? data : game)))
    return { ok: true }
  }

  async function updateGame(id, payload) {
    const res = await apiFetch('/api/games/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || 'не вышло')
      return false
    }
    setGames(games.map((game) => (game.id === id ? data : game)))
    return true
  }

  return (
    <div className={shell === 'guest' ? 'app-shell app-shell--guest' : 'app-shell app-shell--side'}>
      {shell === 'guest' ? (
        <TopNav screen={screen} setScreen={go} />
      ) : (
        <SideNav
          role={shell}
          nick={me?.nick}
          screen={screen === 'member' ? memberBack : screen}
          setScreen={go}
          logout={logout}
        />
      )}

      <main className="app-main">
        {notice ? <p className="notice" role="status">{notice}</p> : null}
        {!KNOWN_SCREENS.has(screen) && (
          <NotFoundScreen
            onHome={() => go(roleHome())}
            onGames={() => go('games')}
            onBack={() => go(previousScreen.current)}
          />
        )}
        {screen === 'home' && (
          <HomeScreen onOpenSchedule={() => go('games')} reloadKey={gamesReload} />
        )}
        {screen === 'games' && (
          <GamesScreen
            me={me}
            games={games}
            reloadKey={gamesReload}
            onBook={book}
            onCreate={createGame}
            onUpdate={updateGame}
            onCancelNight={cancelNight}
            onLogin={() => go('login')}
            onResults={(game) => { setResultsNightId(game.id); go('results') }}
          />
        )}
        {screen === 'rating' && <RatingScreen rating={rating} />}
        {screen === 'news' && (
          <NewsScreen
            me={me}
            news={news}
            onDeleted={(id) => setNews((prev) => prev.filter((item) => item.id !== id))}
            onLogin={() => go('login')}
          />
        )}
        {screen === 'users' && shell === 'admin' && <UsersScreen />}
        {screen === 'members' && shell === 'host' && (
          <MembersScreen onOpen={(id) => { setMemberId(id); setMemberBack('members'); go('member') }} />
        )}
        {screen === 'players' && shell === 'host' && (
          <PlayersScreen onOpen={(id) => { setMemberId(id); setMemberBack('players'); go('member') }} />
        )}
        {screen === 'member' && shell === 'host' && (
          <MemberScreen memberId={memberId} onBack={() => go(memberBack)} />
        )}
        {screen === 'bookings' && <BookingsScreen />}
        {screen === 'profile' && me && <ProfileScreen me={me} onAccount={setMe} />}
        {screen === 'results' && shell === 'host' && <ResultsScreen gameId={resultsNightId} onBack={() => go('games')} />}
        {screen === 'seasons' && shell === 'host' && <SeasonsScreen />}
        {screen === 'overview' && shell === 'admin' && <OverviewScreen setScreen={go} />}
        {screen === 'sanctions' && shell === 'admin' && <SanctionsScreen />}
        {screen === 'excel' && shell === 'admin' && <ExcelScreen />}
        {screen === 'points' && shell === 'host' && <PointRulesScreen />}
        {screen === 'notices' && <NoticesScreen />}
        {screen === 'ranks' && me && <RanksScreen me={me} />}
        {screen === 'about' && (
          <AboutScreen onSchedule={() => go('games')} />
        )}
        {screen === 'catalog' && me && <CatalogScreen me={me} />}
        {screen === 'events' && me && <EventsScreen me={me} />}
        {screen === 'login' && (
          <LoginScreen
            email={email}
            password={password}
            error={error}
            setEmail={setEmail}
            setPassword={setPassword}
            busy={authBusy}
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
            busy={authBusy}
            onSubmit={register}
          />
        )}
        {KNOWN_SCREENS.has(screen) && <Footer />}
      </main>
    </div>
  )
}

export default App
