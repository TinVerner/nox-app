export default function GamesScreen({ me, games, onBook, onCreate }) {
  return (
    <>
      <h1 style={{ color: '#C9A84C' }}>Игры</h1>
      {(me?.role === 'HOST' || me?.role === 'ADMIN') && (
        <form onSubmit={onCreate}>
          <input name="title" placeholder="название" required />
          <input name="startsAt" type="datetime-local" required />
          <input name="place" placeholder="место" required />
          <input name="seats" type="number" placeholder="мест" required />
          <button>Создать игру</button>
        </form>
      )}
      {games.map((game) => (
        <article key={game.id}>
          <h2>{game.title}</h2>
          <p>{new Date(game.startsAt).toLocaleString('ru')} · {game.place} · мест: {game.seats}</p>
          {me && <button onClick={() => onBook(game.id)}>Записаться</button>}
        </article>
      ))}
    </>
  )
}
