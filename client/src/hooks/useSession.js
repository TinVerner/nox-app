import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export function useSession() {
  const [me, setMe] = useState(null)

  useEffect(() => {
    apiFetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe)
      .catch(() => setMe(null))
  }, [])

  async function logout() {
    await apiFetch('/api/logout', { method: 'POST' })
    setMe(null)
  }

  return { me, setMe, logout }
}
