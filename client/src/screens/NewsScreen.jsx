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

function CommentsModal({ item, me, onClose }) {
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/news/' + item.id + '/comments')
      .then((response) => (response.ok ? response.json() : []))
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [item.id])

  async function submit(event) {
    event.preventDefault()
    const body = text.trim()
    if (!body) {
      setError('Напиши комментарий')
      return
    }
    setError('')
    const response = await apiFetch('/api/news/' + item.id + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error || 'не вышло')
      return
    }
    setRows((prev) => [...(prev || []), data])
    setText('')
  }

  async function remove(commentId) {
    setError('')
    const response = await apiFetch('/api/news/' + item.id + '/comments/' + commentId, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error || 'не вышло')
      return
    }
    setRows((prev) => (prev || []).filter((row) => row.id !== commentId))
  }

  return (
    <Modal title={item.title} eyebrow="Комментарии" onClose={onClose} showClose>
      {rows === null ? null : rows.length === 0 ? (
        <p className="muted">пока нет комментариев</p>
      ) : (
        <div className="comment-list">
          {rows.map((row) => (
            <div className="comment" key={row.id}>
              <p>{row.nick}: {row.body}</p>
              {me && row.userId === me.id ? (
                <button type="button" className="btn-ghost btn-s" onClick={() => remove(row.id)}>Удалить</button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {me ? (
        <form className="stack" onSubmit={submit}>
          <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="комментарий" />
          {error ? <p className="error">{error}</p> : null}
          <div className="modal-actions">
            <button type="submit" className="btn-primary">Отправить</button>
          </div>
        </form>
      ) : (
        <p className="muted">Чтобы написать, войди</p>
      )}
    </Modal>
  )
}

export default function NewsScreen({ me, news, onCreate }) {
  const [editor, setEditor] = useState(false)
  const [likes, setLikes] = useState({})
  const [openId, setOpenId] = useState(null)
  const open = news.find((item) => item.id === openId) || null

  async function react(item) {
    if (!me) return
    const response = await apiFetch('/api/news/' + item.id + '/reactions', { method: 'POST' })
    if (!response.ok) return
    const data = await response.json()
    setLikes((prev) => ({ ...prev, [item.id]: data }))
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
      {news.map((item) => {
        const liked = likes[item.id]?.liked ?? item.liked
        const count = likes[item.id]?.likes ?? item.likes ?? 0
        return (
          <article key={item.id} className="panel news-card">
            <h2>{item.title}</h2>
            <p>{item.body}</p>
            <div className="news-actions">
              <button
                type="button"
                className="btn-ghost btn-s news-like"
                aria-pressed={liked ? 'true' : 'false'}
                onClick={() => react(item)}
              >
                Нравится {count}
              </button>
              <button type="button" className="btn-ghost btn-s" onClick={() => setOpenId(item.id)}>
                Комментарий
              </button>
            </div>
          </article>
        )
      })}
      {open && <CommentsModal item={open} me={me} onClose={() => setOpenId(null)} />}
      {editor && (
        <NewsModal onClose={() => setEditor(false)} onSave={onCreate} />
      )}
    </section>
  )
}
