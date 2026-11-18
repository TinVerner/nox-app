const MENUS = {
  player: {
    label: 'ИГРОК',
    items: [
      { screen: 'games', label: 'Расписание' },
      { screen: 'bookings', label: 'Мои записи' },
      { screen: 'profile', label: 'Профиль' },
      { screen: 'news', label: 'Новости' },
      { screen: 'about', label: 'О нас' },
      { screen: 'rating', label: 'Рейтинг' },
      { screen: 'ranks', label: 'Ранг' },
      { screen: 'notices', label: 'Уведомления' },
    ],
  },
  host: {
    label: 'ХОСТ',
    items: [
      { screen: 'games', label: 'Вечера' },
      { screen: 'results', label: 'Партии' },
      { screen: 'points', label: 'Очки' },
      { screen: 'seasons', label: 'Сезоны' },
      { screen: 'players', label: 'Игроки' },
      { screen: 'rules', label: 'Правила' },
      { screen: 'news', label: 'Новости' },
      { screen: 'about', label: 'О нас' },
      { screen: 'ranks', label: 'Заявки' },
      { screen: 'notices', label: 'Уведомления' },
    ],
  },
  admin: {
    label: 'АДМИНИСТРАТОР',
    items: [
      { screen: 'overview', label: 'Обзор' },
      { screen: 'users', label: 'Пользователи' },
      { screen: 'settings', label: 'Настройки' },
      { screen: 'sanctions', label: 'Санкции' },
      { screen: 'news', label: 'Новости' },
      { screen: 'about', label: 'О нас' },
      { screen: 'ranks', label: 'Заявки' },
      { screen: 'notices', label: 'Уведомления' },
    ],
  },
}

export default function SideNav({ role, screen, setScreen, logout, nick }) {
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
        {nick ? <p className="side-nav__nick">{nick}</p> : null}
        <button className="nav-link" onClick={logout}>Выйти</button>
      </div>
    </aside>
  )
}
