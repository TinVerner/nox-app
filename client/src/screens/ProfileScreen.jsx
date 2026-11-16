import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function ProfileScreen({ me }) {
  const [rating, setRating] = useState(null)

  useEffect(() => {
    apiFetch('/api/rating')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRating)
      .catch(() => setRating([]))
  }, [])

  const row = (rating || []).find((item) => item.nick === me?.nick)

  return (
    <section className="screen">
      <h1>Профиль</h1>
      <p>{me?.nick}</p>
      <p>{me?.role}</p>
      {rating === null ? null : row ? (
        <p>{row.points} очков, игр {row.games}</p>
      ) : (
        <p>в рейтинге нет</p>
      )}
    </section>
  )
}
