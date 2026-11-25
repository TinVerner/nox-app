import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

function HeartIcon({ active }) {
  return (
    <svg className="news-heart__icon" viewBox="0 0 24 24" aria-hidden="true">
      {active ? (
        <path
          fill="currentColor"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          d="M12.1 20.55l-.1.1-.11-.1C6.14 15.24 2.5 12.02 2.5 8.5 2.5 5.7 4.7 3.5 7.5 3.5c1.74 0 3.41.88 4.5 2.25C13.09 4.38 14.76 3.5 16.5 3.5c2.8 0 5 2.2 5 5 0 3.52-3.64 6.74-9.4 12.05z"
        />
      )}
    </svg>
  )
}

function AuthLikeModal({ onClose, onLogin }) {
  return (
    <Modal title="Нужен вход" eyebrow="Лайк" onClose={onClose}>
      <p>Чтобы поставить лайк, войдите в аккаунт.</p>
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
        <button type="button" className="btn-primary" onClick={() => { onClose(); onLogin() }}>Войти</button>
      </div>
    </Modal>
  )
}

function CommentsModal({ item, me, onClose, onLogin }) {
  const [rows, setRows] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const isAdmin = me?.role === 'ADMIN'

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
              {me && (isAdmin || row.userId === me.id) ? (
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
        <p className="muted">
          Чтобы написать, <a className="comment-login" href="/login" onClick={(event) => { event.preventDefault(); onLogin() }}>войдите</a>
        </p>
      )}
    </Modal>
  )
}

export default function NewsScreen({ me, news, onDeleted, onLogin }) {
  const [likes, setLikes] = useState({})
  const [openId, setOpenId] = useState(null)
  const [authLike, setAuthLike] = useState(false)
  const [error, setError] = useState('')
  const open = news.find((item) => item.id === openId) || null
  const isAdmin = me?.role === 'ADMIN'

  async function react(item) {
    if (!me) {
      setAuthLike(true)
      return
    }
    const response = await apiFetch('/api/news/' + item.id + '/reactions', { method: 'POST' })
    if (!response.ok) return
    const data = await response.json()
    setLikes((prev) => ({ ...prev, [item.id]: data }))
  }

  async function removePost(item) {
    setError('')
    const response = await apiFetch('/api/news/' + item.id, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error || 'не вышло')
      return
    }
    if (openId === item.id) setOpenId(null)
    onDeleted?.(item.id)
  }

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Новости</p>
          <h1>Лента клуба</h1>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
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
                className="news-heart"
                aria-pressed={liked ? 'true' : 'false'}
                aria-label={liked ? 'Убрать лайк' : 'Нравится'}
                onClick={() => react(item)}
              >
                <HeartIcon active={Boolean(liked)} />
                <span className="news-heart__count">{count}</span>
              </button>
              <button type="button" className="btn-ghost btn-s" onClick={() => setOpenId(item.id)}>
                Комментарии
              </button>
              {isAdmin ? (
                <button type="button" className="btn-ghost btn-s" onClick={() => removePost(item)}>
                  Удалить
                </button>
              ) : null}
            </div>
          </article>
        )
      })}
      {open && <CommentsModal item={open} me={me} onClose={() => setOpenId(null)} onLogin={onLogin} />}
      {authLike && <AuthLikeModal onClose={() => setAuthLike(false)} onLogin={onLogin} />}
    </section>
  )
}
