import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function NewsScreen({ me, news, onCreate }) {
  const [comments, setComments] = useState({})
  const [drafts, setDrafts] = useState({})

  useEffect(() => {
    if (!news.length) {
      setComments({})
      return
    }
    let cancelled = false
    Promise.all(news.map((item) =>
      apiFetch('/api/news/' + item.id + '/comments')
        .then((r) => (r.ok ? r.json() : []))
        .then((rows) => [item.id, rows])
        .catch(() => [item.id, []])
    )).then((pairs) => {
      if (!cancelled) setComments(Object.fromEntries(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [news])

  async function comment(e, newsId) {
    e.preventDefault()
    const text = (drafts[newsId] || '').trim()
    if (!text) return
    const res = await apiFetch('/api/news/' + newsId + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    })
    if (!res.ok) return alert('не вышло')
    const row = await res.json()
    setComments((prev) => ({ ...prev, [newsId]: [...(prev[newsId] || []), row] }))
    setDrafts((prev) => ({ ...prev, [newsId]: '' }))
  }

  return (
    <section className="screen">
      <p className="eyebrow">Новости</p>
      <h1>Лента клуба</h1>
      {me?.role === 'ADMIN' && (
        <form className="panel stack" onSubmit={onCreate} style={{ marginBottom: 16 }}>
          <input name="title" placeholder="заголовок" required />
          <input name="body" placeholder="текст" required />
          <button type="submit">Опубликовать</button>
        </form>
      )}
      {news.map((item) => (
        <article key={item.id} className="panel news-card">
          <h2>{item.title}</h2>
          <p>{item.body}</p>
          {(comments[item.id] || []).map((row) => (
            <p className="comment" key={row.id}>{row.nick}: {row.body}</p>
          ))}
          {me && (
            <form className="stack" onSubmit={(e) => comment(e, item.id)}>
              <textarea
                value={drafts[item.id] || ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                placeholder="комментарий"
              />
              <button type="submit" className="btn-secondary">Комментировать</button>
            </form>
          )}
        </article>
      ))}
    </section>
  )
}
