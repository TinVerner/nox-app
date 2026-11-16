const LINKS = [
  { screen: 'home', label: 'Главная' },
  { screen: 'games', label: 'Расписание' },
  { screen: 'rating', label: 'Рейтинг' },
  { screen: 'members', label: 'Участники' },
  { screen: 'login', label: 'Войти' },
  { screen: 'register', label: 'Регистрация' },
]

export default function TopNav({ screen, setScreen }) {
  return (
    <header className="top-nav">
      <button className="brand" onClick={() => setScreen('home')}>NOX</button>
      <nav>
        {LINKS.map((item) => (
          <button
            key={item.screen}
            className="nav-link"
            aria-current={screen === item.screen ? 'page' : undefined}
            onClick={() => setScreen(item.screen)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
