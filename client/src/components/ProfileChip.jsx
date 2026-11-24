const ROLE = {
  PLAYER: 'Игрок',
  HOST: 'Ведущий',
  ADMIN: 'Администратор',
}

function initialOf(nick) {
  const text = (nick || '').trim()
  return text ? text.charAt(0).toUpperCase() : '?'
}

export default function ProfileChip({ nick, role, onOpen }) {
  const displayNick = (nick || '').trim()
  if (!displayNick) return null

  const roleLabel = ROLE[role] || role || ''

  return (
    <button
      type="button"
      className="profile-chip"
      onClick={onOpen}
      aria-label={`Открыть профиль: ${displayNick}${roleLabel ? `, ${roleLabel}` : ''}`}
    >
      <span className="profile-chip__avatar" aria-hidden="true">{initialOf(displayNick)}</span>
      <span className="profile-chip__text">
        <span className="profile-chip__nick">{displayNick}</span>
        {roleLabel ? <span className="profile-chip__role">{roleLabel}</span> : null}
      </span>
    </button>
  )
}
