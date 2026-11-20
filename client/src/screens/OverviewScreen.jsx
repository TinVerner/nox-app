export default function OverviewScreen({ setScreen }) {
  return (
    <section className="screen screen--overview">
      <p className="eyebrow">Управление клубом</p>
      <h1>Обзор</h1>
      <div className="link-grid">
        <button type="button" className="panel-link" onClick={() => setScreen('users')}>Пользователи</button>
        <button type="button" className="panel-link" onClick={() => setScreen('members')}>Участники</button>
      </div>
    </section>
  )
}
