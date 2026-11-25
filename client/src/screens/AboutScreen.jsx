const ADDRESS = 'г. Минск, ул. Леонида Беды, 11'
const ADDRESS_MAPS_URL =
  'https://yandex.ru/maps/?text=' + encodeURIComponent(ADDRESS)

const CONTACTS = [
  { label: 'Адрес', value: ADDRESS, href: ADDRESS_MAPS_URL },
  { label: 'Телефон', value: '+375 33 471 23 67' },
  { label: 'Telegram', value: '@Nox_Club_Mafia' },
  { label: 'Instagram', value: 'NOX_Club_Mafia' },
]

export default function AboutScreen({ onSchedule }) {
  return (
    <section className="screen screen--about">
      <p className="eyebrow">О нас</p>
      <h1>О клубе NOX</h1>
      <p className="lede">Клуб спортивной «Мафии» в Минске.</p>
      <article className="about-hero">
        <div className="about-hero__copy">
          <h2>Игровые вечера в Минске</h2>
          <p>Открытые столы и обучающие вечера. Формат, время и стоимость участия указаны в расписании.</p>
          <div className="about-hero__actions">
            <button type="button" className="btn-primary" onClick={onSchedule}>Вечера клуба</button>
          </div>
        </div>
        <aside className="about-mark">
          <p className="about-mark__brand">NOX</p>
          <p className="about-mark__meta">Минск · Mafia Club</p>
          <p className="about-mark__line">Клуб спортивной мафии</p>
        </aside>
      </article>
      <section className="about-block">
        <h2>Контакты</h2>
        <dl className="about-contacts">
          {CONTACTS.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                {item.href ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer">
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </section>
  )
}
