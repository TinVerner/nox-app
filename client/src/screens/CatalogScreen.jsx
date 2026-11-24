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
  const player = me?.role === 'PLAYER'
  const [items, setItems] = useState(null)
  const [bonus, setBonus] = useState(me?.bonus ?? null)
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
    if (player) {
      apiFetch('/api/me')
        .then((response) => (response.ok ? response.json() : null))
        .then((account) => setBonus(account ? account.bonus : null))
        .catch(() => setBonus(null))
    }
  }, [staff, player])

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
      setItems((rows) => [...(rows || []), data].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
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

  async function buy(item) {
    setError('')
    const response = await apiFetch('/api/catalog/' + item.id + '/buy', { method: 'POST' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || 'не вышло')
    setBonus(data.bonus)
  }

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Клуб</p>
          <h1>Каталог услуг</h1>
          {staff ? (
            <p className="lede">В данном разделе вы можете приобрести подарочные сертификаты на игры либо именные маски.</p>
          ) : player ? (
            <p className="lede">
              В данном разделе вы можете приобрести подарочные сертификаты на игры либо именные маски.
              Бонусы: {bonus == null ? '—' : bonus}.
            </p>
          ) : (
            <p className="lede">В данном разделе вы можете приобрести подарочные сертификаты на игры либо именные маски.</p>
          )}
        </div>
        {staff && (
          <button type="button" className="btn-primary" onClick={() => setEditor(true)}>Создать товар</button>
        )}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {items === null ? null : items.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="catalog-grid">
          {items.map((item) => (
            <article key={item.id} className="catalog-tile">
              <div className="catalog-tile__body">
                <h2>{item.name}</h2>
                {item.description ? <p>{item.description}</p> : null}
                <p className="muted">{money(item.cashPrice)} BYN · {money(item.bonusPrice)} бонусов</p>
                {staff && !item.active ? <p className="muted">скрыт</p> : null}
              </div>
              <div className="catalog-tile__actions">
                {staff ? (
                  <>
                    <button type="button" className="btn-secondary btn-s" onClick={() => setEditor(item)}>Изменить</button>
                    <button type="button" className="btn-ghost btn-s" onClick={() => removeItem(item)}>Удалить</button>
                  </>
                ) : player ? (
                  <button type="button" className="btn-primary btn-s" onClick={() => buy(item)} disabled={item.bonusPrice == null}>
                    Списать бонусы
                  </button>
                ) : null}
              </div>
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
