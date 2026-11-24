import { useEffect, useState } from 'react'
import { apiFetch } from '../api'
import Modal from '../components/Modal'

const EMPTY = { name: '', description: '', cashPrice: '', bonusPrice: '' }

function money(value) {
  return value == null ? '—' : value
}

function CatalogModal({ item, onClose, onSave }) {
  const [draft, setDraft] = useState(item
    ? {
      name: item.name,
      description: item.description || '',
      cashPrice: item.cashPrice ?? '',
      bonusPrice: item.bonusPrice ?? '',
    }
    : EMPTY)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    const ok = await onSave(draft)
    if (ok === false) setError('не вышло')
    else if (typeof ok === 'string') setError(ok)
    else onClose()
  }

  return (
    <Modal title={item ? 'Изменить товар' : 'Новый товар'} eyebrow="Каталог" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="название" required />
        <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="описание" />
        <input value={draft.cashPrice} onChange={(event) => setDraft({ ...draft, cashPrice: event.target.value })} placeholder="цена, BYN" inputMode="decimal" />
        <input value={draft.bonusPrice} onChange={(event) => setDraft({ ...draft, bonusPrice: event.target.value })} placeholder="цена в бонусах" inputMode="decimal" />
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit" className="btn-primary">Сохранить</button>
        </div>
      </form>
    </Modal>
  )
}

export default function CatalogScreen({ me }) {
  const staff = me?.role === 'HOST'
  const [items, setItems] = useState(null)
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')

  function load() {
    apiFetch('/api/catalog')
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
  }

  useEffect(() => {
    load()
  }, [staff])

  async function saveItem(draft) {
    setError('')
    const editing = editor && editor !== true ? editor : null
    const response = await apiFetch(editing ? '/api/catalog/' + editing.id : '/api/catalog', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        cashPrice: draft.cashPrice,
        bonusPrice: draft.bonusPrice,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return data.error || 'не вышло'
    if (editing) {
      setItems((rows) => (rows || []).map((row) => (row.id === data.id ? data : row)))
    } else {
      setItems((rows) => [...(rows || []), data].sort((a, b) => (a.cashPrice ?? 0) - (b.cashPrice ?? 0)))
    }
    return true
  }

  async function removeItem(item) {
    setError('')
    const response = await apiFetch('/api/catalog/' + item.id, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return setError(data.error || 'не вышло')
    }
    setItems((rows) => (rows || []).filter((row) => row.id !== item.id))
  }

  const visible = (items || []).filter((item) => staff || item.active !== false)

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Клуб</p>
          <h1>Каталог услуг</h1>
          <p className="lede">
            Подарочные сертификаты и именные маски. Если хотите заказать — свяжитесь с ведущим.
          </p>
        </div>
        {staff && (
          <button type="button" className="btn-primary" onClick={() => setEditor(true)}>Создать товар</button>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {items === null ? null : visible.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="catalog-grid">
          {visible.map((item) => (
            <article key={item.id} className="catalog-tile">
              <div className="catalog-tile__body">
                <h2>{item.name}</h2>
                {item.description ? <p>{item.description}</p> : null}
                <p className="price">{money(item.cashPrice)} BYN</p>
                {staff && !item.active ? <p className="muted">скрыт</p> : null}
              </div>
              {staff ? (
                <div className="catalog-tile__actions">
                  <button type="button" className="btn-secondary btn-s" onClick={() => setEditor(item)}>Изменить</button>
                  <button type="button" className="btn-ghost btn-s" onClick={() => removeItem(item)}>Удалить</button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
      {editor && (
        <CatalogModal
          item={editor === true ? null : editor}
          onClose={() => setEditor(null)}
          onSave={saveItem}
        />
      )}
    </section>
  )
}
