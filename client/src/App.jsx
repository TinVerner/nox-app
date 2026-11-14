import { useState } from 'react'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nick, setNick] = useState('')
  const [me, setMe] = useState(null)
  const [error, setError] = useState('')

  async function login(e) {
    e.preventDefault()
    setError('')
    const res = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'ошибка')
      return
    }
    const meRes = await fetch('http://localhost:3000/api/me', { credentials: 'include' })
    setMe(await meRes.json())
  }

  async function logout() {
    await fetch('http://localhost:3000/api/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setMe(null)
  }

  async function register(e) {
    e.preventDefault()
    setError('')
    const res = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nick }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'ошибка')
      return
    }
    alert('аккаунт создан, теперь войди')
  }

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 40, background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ color: '#C9A84C' }}>NOX</h1>
      <form onSubmit={login}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} />
        <button type="button" onClick={register}>Регистрация</button>
        <button type="submit">Войти</button>
      </form>
      {error && <p>{error}</p>}
      {me && <p>Вошла: {me.userId}</p>}
      {me && <button type="button" onClick={logout}>Выйти</button>}
    </main>
  )
}

export default App