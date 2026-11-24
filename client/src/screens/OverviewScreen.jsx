export default function OverviewScreen({ setScreen }) {
  return (
    <section className="screen screen--overview">
      <p className="eyebrow">Управление клубом</p>
      <h1>Обзор</h1>
      <div className="link-grid">
        <button type="button" className="panel-link" onClick={() => setScreen('users')}>Пользователи</button>
        <button type="button" className="panel-link" onClick={() => setScreen('sanctions')}>Санкции</button>
        <button type="button" className="panel-link" onClick={() => setScreen('excel')}>Excel</button>
        <button type="button" className="panel-link" onClick={() => setScreen('news')}>Новости</button>
      </div>
    </section>
  )
}
