const MENUS = {
  player: {
    label: 'ИГРОК',
    items: [
      { screen: 'games', label: 'Расписание' },
      { screen: 'bookings', label: 'Мои записи' },
      { screen: 'profile', label: 'Профиль' },
      { screen: 'news', label: 'Новости' },
      { screen: 'rating', label: 'Рейтинг' },
    ],
  },
  host: {
    label: 'ХОСТ',
    items: [
      { screen: 'games', label: 'Вечера' },
      { screen: 'results', label: 'Результаты' },
      { screen: 'seasons', label: 'Сезоны' },
    ],
  },
  admin: {
    label: 'АДМИНИСТРАТОР',
    items: [
      { screen: 'overview', label: 'Обзор' },
      { screen: 'users', label: 'Пользователи' },
      { screen: 'settings', label: 'Настройки' },
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
      <button className="nav-link side-nav__logout" onClick={logout}>Выйти</button>
    </aside>
  )
}
