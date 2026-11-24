import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const EMPTY = { name: '', description: '', cashPrice: '', bonusPrice: '' }

function money(value) {
  return value == null ? '—' : value
}

export default function CatalogScreen({ me }) {
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const [items, setItems] = useState(null)
  const [bonus, setBonus] = useState(me?.bonus ?? null)
  const [draft, setDraft] = useState(EMPTY)
  const [error, setError] = useState('')

  function load() {
    apiFetch('/api/catalog')
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
  }

  useEffect(() => {
    load()
    if (!staff) {
      apiFetch('/api/me')
        .then((response) => (response.ok ? response.json() : null))
        .then((account) => setBonus(account ? account.bonus : null))
        .catch(() => setBonus(null))
    }
  }, [staff])

  async function createItem(event) {
    event.preventDefault()
    setError('')
    const response = await apiFetch('/api/catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        cashPrice: draft.cashPrice,
        bonusPrice: draft.bonusPrice,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || 'не вышло')
    setDraft(EMPTY)
    setItems((rows) => [...(rows || []), data].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
  }

  async function saveItem(item, patch) {
    setError('')
    const response = await apiFetch('/api/catalog/' + item.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return setError(data.error || 'не вышло')
    setItems((rows) => (rows || []).map((row) => (row.id === data.id ? data : row)))
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
      <p className="eyebrow">Клуб</p>
      <h1>Каталог услуг</h1>
      {staff ? (
        <p className="lede">Название, описание, цена в BYN и цена в бонусах.</p>
      ) : (
        <p className="lede">Бонусы: {bonus == null ? '—' : bonus}. Покупка списывает цену в бонусах.</p>
      )}
      {staff && (
        <form className="panel stack" onSubmit={createItem}>
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="название" required />
          <textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="описание" />
          <input value={draft.cashPrice} onChange={(event) => setDraft({ ...draft, cashPrice: event.target.value })} placeholder="цена, BYN" inputMode="decimal" />
          <input value={draft.bonusPrice} onChange={(event) => setDraft({ ...draft, bonusPrice: event.target.value })} placeholder="цена в бонусах" inputMode="decimal" />
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" className="btn-primary">Добавить</button>
        </form>
      )}
      {items === null ? null : items.length === 0 ? (
        <p className={staff ? 'muted form-follow' : 'muted'}>пусто</p>
      ) : (
        <div className={staff ? 'stack form-follow' : 'stack'}>
          {!staff && error ? <p className="error">{error}</p> : null}
          {items.map((item) => (
            <article key={item.id} className="panel catalog-card">
              {staff ? (
                <CatalogEditor item={item} onSave={(patch) => saveItem(item, patch)} />
              ) : (
                <>
                  <h2>{item.name}</h2>
                  {item.description ? <p>{item.description}</p> : null}
                  <p className="muted">{money(item.cashPrice)} BYN · {money(item.bonusPrice)} бонусов</p>
                  <button type="button" className="btn-primary btn-s" onClick={() => buy(item)} disabled={item.bonusPrice == null}>
                    Списать бонусы
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function CatalogEditor({ item, onSave }) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description || '')
  const [cashPrice, setCashPrice] = useState(item.cashPrice ?? '')
  const [bonusPrice, setBonusPrice] = useState(item.bonusPrice ?? '')

  return (
    <>
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      <input value={cashPrice} onChange={(event) => setCashPrice(event.target.value)} placeholder="BYN" inputMode="decimal" />
      <input value={bonusPrice} onChange={(event) => setBonusPrice(event.target.value)} placeholder="бонусы" inputMode="decimal" />
      <div className="user-actions">
        <button
          type="button"
          className="btn-primary btn-s"
          onClick={() => onSave({ name, description, cashPrice, bonusPrice })}
        >
          Сохранить
        </button>
        <button type="button" className="btn-ghost btn-s" onClick={() => onSave({ active: !item.active })}>
          {item.active ? 'Скрыть' : 'Показать'}
        </button>
      </div>
    </>
  )
}
