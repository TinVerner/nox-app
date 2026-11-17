import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

export default function CatalogScreen() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    apiFetch('/api/catalog')
      .then((response) => (response.ok ? response.json() : []))
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  return (
    <section className="screen">
      <p className="eyebrow">Клуб</p>
      <h1>Каталог</h1>
      <p className="lede">Абонементы, сертификаты и маски. Цены клуба CRIME, в BYN.</p>
      {items === null ? null : items.length === 0 ? (
        <p className="muted">пусто</p>
      ) : (
        <div className="stack">
          {items.map((item) => (
            <article key={item.id} className="panel">
              <h2>{item.name}</h2>
              {item.detail ? <p className="muted">{item.detail}</p> : null}
              <p className="price">{item.name === 'Сертификат на закрытую игру' ? 'от 400 BYN до 1400 BYN' : `${item.price} BYN`}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
