const STATUS_LABEL = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  DONE: 'Завершён',
}

export default function GamesScreen({ me, games, onBook, onCreate, onLogin, onStatus }) {
  const staff = me?.role === 'HOST' || me?.role === 'ADMIN'
  const title = me?.role === 'HOST' ? 'Вечера' : 'Расписание'

  return (
    <section className="screen">
      <h1>{title}</h1>
      {staff && (
        <form onSubmit={onCreate}>
          <input name="title" placeholder="название" required />
          <input name="startsAt" type="datetime-local" required />
          <input name="place" placeholder="место" required />
          <input name="seats" type="number" placeholder="мест" required />
          <button>Создать игру</button>
        </form>
      )}
      {games.map((game) => (
        <article key={game.id} className="game-row">
          <span className="game-row__date">{new Date(game.startsAt).toLocaleString('ru')}</span>
          <h2 className="game-row__title">{game.title}</h2>
          <span>{game.place}</span>
          <span>мест: {game.seats}</span>
          <button onClick={() => (me ? onBook(game.id) : onLogin())}>Записаться</button>
          {staff && (
            <div className="game-status">
              <span>{STATUS_LABEL[game.status] || game.status}</span>
              <button type="button" onClick={() => onStatus(game.id, 'DRAFT')}>Черновик</button>
              <button type="button" onClick={() => onStatus(game.id, 'PUBLISHED')}>Опубликован</button>
              <button type="button" onClick={() => onStatus(game.id, 'DONE')}>Завершён</button>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}
