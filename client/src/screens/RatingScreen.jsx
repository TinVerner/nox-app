export default function RatingScreen({ rating }) {
  return (
    <>
      <h1 style={{ color: '#C9A84C' }}>Рейтинг</h1>
      <ol>
        {rating.map((row) => (
          <li key={row.id}>{row.nick}: {row.points} очков, игр {row.games}</li>
        ))}
      </ol>
    </>
  )
}
