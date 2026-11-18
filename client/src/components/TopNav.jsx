const LINKS = [
  { screen: 'home', label: 'Главная' },
  { screen: 'games', label: 'Расписание' },
  { screen: 'rating', label: 'Рейтинг' },
  { screen: 'news', label: 'Новости' },
  { screen: 'about', label: 'О нас' },
]

export default function TopNav({ screen, setScreen }) {
  return (
    <header className="top-nav">
      <div className="brand-lockup">
        <button className="brand" onClick={() => setScreen('home')}>NOX</button>
        <p className="brand-sub">клуб</p>
      </div>
      <nav className="top-nav__links">
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
      <div className="top-nav__auth">
        <button className="nav-link" aria-current={screen === 'login' ? 'page' : undefined} onClick={() => setScreen('login')}>Войти</button>
        <button className="btn-primary btn-s" aria-current={screen === 'register' ? 'page' : undefined} onClick={() => setScreen('register')}>Регистрация</button>
      </div>
    </header>
  )
}
