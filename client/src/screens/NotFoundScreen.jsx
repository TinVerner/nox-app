export default function NotFoundScreen({ onHome, onGames, onBack }) {
  return (
    <section className="screen not-found">
      <div className="not-found__main">
        <p className="not-found__code">404</p>
        <div className="not-found__rule" />
        <h1>Страница не найдена</h1>
        <p className="not-found__text">Возможно, ссылка устарела или в адресе есть опечатка. Выберите, куда вернуться.</p>
        <div className="not-found__actions">
          <button type="button" className="btn-primary" onClick={onHome}>На главную</button>
          <button type="button" className="btn-secondary" onClick={onGames}>Расписание вечеров</button>
        </div>
        <button type="button" className="not-found__back" onClick={onBack}>← Вернуться назад</button>
      </div>
      <footer className="not-found__foot">
        <span>© 2026 NOX · Минск</span>
        <span>Клуб спортивной мафии</span>
      </footer>
    </section>
  )
}
