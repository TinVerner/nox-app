export default function RegisterScreen({ email, nick, password, error, setEmail, setNick, setPassword, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <h2>Регистрация</h2>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} />
      <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Создать</button>
      {error && <p>{error}</p>}
    </form>
  )
}
