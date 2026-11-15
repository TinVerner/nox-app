export default function UsersScreen({ users, onSetRole }) {
  return (
    <>
      <h1 style={{ color: '#C9A84C' }}>Люди</h1>
      {users.map((user) => (
        <p key={user.id}>
          {user.nick} · {user.email} · {user.role}{' '}
          <button onClick={() => onSetRole(user.id, 'PLAYER')}>PLAYER</button>{' '}
          <button onClick={() => onSetRole(user.id, 'HOST')}>HOST</button>{' '}
          <button onClick={() => onSetRole(user.id, 'ADMIN')}>ADMIN</button>
        </p>
      ))}
    </>
  )
}
