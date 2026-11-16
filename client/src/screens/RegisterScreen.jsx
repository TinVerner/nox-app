export default function RegisterScreen({ email, nick, password, passwordAgain, error, setEmail, setNick, setPassword, setPasswordAgain, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <h2>Регистрация</h2>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="ник" value={nick} onChange={(e) => setNick(e.target.value)} />
      <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <input placeholder="пароль ещё раз" type="password" value={passwordAgain} onChange={(e) => setPasswordAgain(e.target.value)} />
      <button type="submit">Создать</button>
      {error && <p>{error}</p>}
    </form>
  )
}
