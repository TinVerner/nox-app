export default function OverviewScreen({ setScreen }) {
  return (
    <section className="screen">
      <h1>Обзор</h1>
      <button type="button" onClick={() => setScreen('users')}>Пользователи</button>
      <button type="button" onClick={() => setScreen('settings')}>Настройки</button>
      <button type="button" onClick={() => setScreen('members')}>Участники</button>
    </section>
  )
}
