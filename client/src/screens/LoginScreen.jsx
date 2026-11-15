export default function LoginScreen({ email, password, error, setEmail, setPassword, onSubmit }) {
  return (
    <form onSubmit={onSubmit}>
      <h2>Вход</h2>
      <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Войти</button>
      {error && <p>{error}</p>}
    </form>
  )
}
