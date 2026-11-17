export default function RegisterScreen({ email, nick, password, passwordAgain, error, busy, setEmail, setNick, setPassword, setPasswordAgain, onSubmit }) {
  return (
    <section className="auth">
      <div className="auth-brand">
        <div>
          <p className="brand">NOX</p>
          <p className="brand-sub">Клуб спортивной мафии</p>
        </div>
        <div>
          <p className="eyebrow">Новый игрок</p>
          <h2>Место за столом ещё свободно.</h2>
          <p className="lede">Ник, почта и пароль. После входа откроются записи и рейтинг.</p>
        </div>
        <p className="muted">NOX · Минск</p>
      </div>
      <div className="auth-panel">
        <form className="stack" onSubmit={onSubmit}>
          <p className="eyebrow">Регистрация</p>
          <h1>Создать аккаунт</h1>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} />
          <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input placeholder="пароль ещё раз" type="password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} />
          <button type="submit" disabled={busy}>{busy ? 'Регистрация…' : 'Создать'}</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </section>
  )
}
