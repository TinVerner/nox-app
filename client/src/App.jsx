import { useState } from 'react'

function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 40, background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ color: '#C9A84C' }}>NOX</h1>
      <form onSubmit={login}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit">Войти</button>
      </form>
      {error && <p>{error}</p>}
      {me && <p>Вошла: {me.userId}</p>}
    </main>
  )
}

export default App