export default function LoginScreen({ email, password, error, setEmail, setPassword, onSubmit }) {
  return (
    <section className="auth">
      <div className="auth-brand">
        <div>
          <p className="brand">NOX</p>
          <p className="brand-sub">Клуб спортивной мафии</p>
        </div>
        <div>
          <p className="eyebrow">За одним столом</p>
          <h2>Город засыпает. Игра начинается.</h2>
          <p className="lede">Ваши вечера, результаты и место в рейтинге клуба — в одном кабинете.</p>
        </div>
        <p className="muted">NOX · Минск</p>
      </div>
      <div className="auth-panel">
        <form className="stack" onSubmit={onSubmit}>
          <p className="eyebrow">Возвращение в клуб</p>
          <h1>Вход в аккаунт</h1>
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit">Войти</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </section>
  )
}
