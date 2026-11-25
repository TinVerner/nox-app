const MENUS = {
  player: {
    label: 'ИГРОК',
    items: [
      { screen: 'games', label: 'Расписание' },
      { screen: 'played', label: 'Сыгранные' },
      { screen: 'bookings', label: 'Мои записи' },
      { screen: 'profile', label: 'Профиль' },
      { screen: 'news', label: 'Новости' },
      { screen: 'about', label: 'О нас' },
      { screen: 'rating', label: 'Рейтинг' },
      { screen: 'notices', label: 'Уведомления' },
    ],
  },
  host: {
    label: 'ХОСТ',
    items: [
      { screen: 'games', label: 'Вечера' },
      { screen: 'played', label: 'Сыгранные' },
      { screen: 'players', label: 'Игроки' },
      { screen: 'profile', label: 'Профиль' },
      { screen: 'points', label: 'Правила начисления' },
      { screen: 'news', label: 'Новости' },
      { screen: 'about', label: 'О нас' },
      { screen: 'rating', label: 'Рейтинг' },
      { screen: 'notices', label: 'Уведомления' },
    ],
  },
  admin: {
    label: 'АДМИНИСТРАТОР',
    items: [
      { screen: 'users', label: 'Пользователи' },
      { screen: 'excel', label: 'Excel' },
      { screen: 'news', label: 'Новости' },
      { screen: 'profile', label: 'Профиль' },
      { screen: 'about', label: 'О нас' },
      { screen: 'notices', label: 'Уведомления' },
    ],
  },
}

export default function SideNav({ role, screen, setScreen, logout }) {
  const menu = MENUS[role] || MENUS.player

  return (
    <aside className="side-nav">
      <div>
        <p className="brand">NOX</p>
        <p className="shell-label">{menu.label}</p>
      </div>
      <nav>
        {menu.items.map((item) => (
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
      <div className="side-nav__foot">
        <button className="nav-link" onClick={logout}>Выйти</button>
      </div>
    </aside>
  )
}
