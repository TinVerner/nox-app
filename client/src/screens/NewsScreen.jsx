import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

function NewsModal({ onClose, onSave }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!title.trim() || !body.trim()) {
      setError('Заполни поля')
      return
    }
    setError('')
    const ok = await onSave({ title: title.trim(), body: body.trim() })
    if (ok) onClose()
  }

  return (
    <Modal title="Новая новость" eyebrow="Новости" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="заголовок" />
        <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="текст" />
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Опубликовать</button>
        </div>
      </form>
    </Modal>
  )
}

export default function NewsScreen({ me, news, onCreate }) {
  const [comments, setComments] = useState({})
  const [drafts, setDrafts] = useState({})
  const [editor, setEditor] = useState(false)

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
      <div className="page-head">
        <div>
          <p className="eyebrow">Новости</p>
          <h1>Лента клуба</h1>
        </div>
        {me?.role === 'ADMIN' && (
          <button type="button" className="btn-primary" onClick={() => setEditor(true)}>Новая новость</button>
        )}
      </div>
      {news.length === 0 && <p className="muted">пусто</p>}
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
      {editor && (
        <NewsModal onClose={() => setEditor(false)} onSave={onCreate} />
      )}
    </section>
  )
}
