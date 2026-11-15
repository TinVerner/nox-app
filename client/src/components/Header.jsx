export default function Header({ me, setScreen, logout }) {
  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', borderBottom: '1px solid #2a2a2a' }}>
      <b style={{ color: '#C9A84C', fontSize: 24, cursor: 'pointer' }} onClick={() => setScreen('home')}>NOX</b>
      <nav style={{ display: 'flex', gap: 16 }}>
        <span onClick={() => setScreen('games')} style={{ cursor: 'pointer' }}>Игры</span>
        <span onClick={() => setScreen('rating')} style={{ cursor: 'pointer' }}>Рейтинг</span>
        <span onClick={() => setScreen('news')} style={{ cursor: 'pointer' }}>Новости</span>
        {me?.role === 'ADMIN' && (
          <span onClick={() => setScreen('users')} style={{ cursor: 'pointer' }}>Люди</span>
        )}
      </nav>
      {me ? (
        <div>
          {me.nick} · {me.role}{' '}
          <button onClick={logout}>Выйти</button>
        </div>
      ) : (
        <div>
          <button onClick={() => setScreen('login')}>Войти</button>{' '}
          <button onClick={() => setScreen('register')}>Регистрация</button>
        </div>
      )}
    </header>
  )
}
