export default function NewsScreen({ me, news, onCreate }) {
  return (
    <>
      <h1 style={{ color: '#C9A84C' }}>Новости</h1>
      {me?.role === 'ADMIN' && (
        <form onSubmit={onCreate}>
          <input name="title" placeholder="заголовок" required />
          <input name="body" placeholder="текст" required />
          <button>Опубликовать</button>
        </form>
      )}
      {news.map((item) => (
        <article key={item.id}>
          <h2>{item.title}</h2>
          <p>{item.body}</p>
        </article>
      ))}
    </>
  )
}
