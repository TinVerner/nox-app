import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [api, setApi] = useState('загрузка…')

  useEffect(() => {
    fetch('http://localhost:3000/api/health')
      .then((r) => r.json())
      .then((data) => setApi(data.message))
      .catch(() => setApi('API недоступен'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 40, background: '#111', color: '#eee', minHeight: '100vh' }}>
      <h1 style={{ color: '#C9A84C' }}>NOX</h1>
      <p>Ответ API: {api}</p>
    </main>
  )
}

export default App