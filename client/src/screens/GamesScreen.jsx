import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import CancelBookingDialog from '../components/CancelBookingDialog'
import RemoveRosterDialog from '../components/RemoveRosterDialog'
import { apiFetch } from '../api'

const FILTERS = [
  { id: 'ALL', label: 'Все' },
  { id: 'CLASSIC', label: 'Классика' },
  { id: 'NOVICE', label: 'Новички' },
]

const WEEKS = [
  { id: 'WEEK', label: 'Эта неделя' },
  { id: 'ALL', label: 'Все' },
]

const MINSK_WEEKDAY = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }

function minskWeek(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Minsk',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type) => parts.find((part) => part.type === type).value
  const monday = new Date(Date.UTC(Number(value('year')), Number(value('month')) - 1, Number(value('day'))))
  monday.setUTCDate(monday.getUTCDate() - MINSK_WEEKDAY[value('weekday')])
  const start = monday.getTime() - 3 * 60 * 60 * 1000
  return { start, end: start + 7 * 24 * 60 * 60 * 1000 }
}

function inMinskWeek(iso, range) {
  const time = new Date(iso).getTime()
  return time >= range.start && time < range.end
}

const STATUS_LABEL = {
  DRAFT: 'Черновик',
  PUBLISHED: 'Опубликован',
  DONE: 'Завершён',
  CANCELLED: 'Отменён',
}

const KIND_LABEL = {
  CLASSIC: 'Классика',
  NOVICE: 'Новички',
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function minskFields(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Minsk',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type) => parts.find((part) => part.type === type).value
  return value
}

function nightParts(iso, endsAt) {
  const value = minskFields(iso)
  if (!value) return { label: '', time: '' }
  const end = endsAt ? minskFields(endsAt) : null
  const startClock = `${value('hour')}:${value('minute')}`
  const time = end ? `${startClock}–${end('hour')}:${end('minute')}` : startClock
  return {
    label: `${DAYS[WEEKDAY[value('weekday')]]} ${Number(value('day'))} ${MONTHS[Number(value('month')) - 1]}`,
    time,
  }
}

function toMinskInput(iso) {
  const value = minskFields(iso)
  if (!value) return ''
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}

function liveMark(game, now = Date.now()) {
  if (game.status === 'CANCELLED') return { text: 'Отменён', className: 'status-muted' }
  const start = new Date(game.startsAt).getTime()
  const end = game.endsAt ? new Date(game.endsAt).getTime() : null
  if (end != null && now >= end) return { text: 'игра завершена', className: 'status-muted' }
  if (end != null && now >= start && now < end) return { text: 'игра идёт', className: 'status-wait' }
  return {
    text: STATUS_LABEL[game.status] || game.status,
    className: game.status === 'PUBLISHED' ? 'status-ok' : 'status-muted',
  }
}

/** Правка и отмена вечера — только до старта, не для завершённых/отменённых */
function canManageNight(game, now = Date.now()) {
  if (!game || game.status === 'CANCELLED' || game.status === 'DONE') return false
  const start = new Date(game.startsAt).getTime()
  return !Number.isNaN(start) && start > now
}

function canCancelNight(game, now = Date.now()) {
  return canManageNight(game, now)
}

function canEditNight(game, now = Date.now()) {
  return canManageNight(game, now)
}

/** Результаты — только после старта; до старта остаются Изменить/Отменить */
function canOpenResults(game, now = Date.now()) {
  if (!game || game.status === 'CANCELLED') return false
  const start = new Date(game.startsAt).getTime()
  return !Number.isNaN(start) && start <= now
}

/** Удалить вечер целиком — после старта / для отменённых (каскад + рейтинг) */
function canDeleteNight(game, now = Date.now()) {
  if (!game) return false
  if (game.status === 'CANCELLED') return true
  const start = new Date(game.startsAt).getTime()
  return !Number.isNaN(start) && start <= now
}

function resultsButtonLabel(game) {
  if (game?.resultsStatus === 'PUBLISHED') return 'Результаты'
  if (game?.resultsStatus === 'DRAFT') return 'Результаты'
  return 'Результаты'
}

function bookLabel(game) {
  return (game.taken ?? 0) >= game.seats ? 'Лист ожидания' : 'Записаться'
}

function indexBookings(rows) {
  const map = {}
  const ids = []
  if (!Array.isArray(rows)) return { map, ids }
  for (const row of rows) {
    const gameId = Number(row.gameId)
    if (!gameId || !row.id) continue
    map[gameId] = row.id
    ids.push(gameId)
  }
  return { map, ids }
}

function isBooked(ids, gameId) {
  const target = Number(gameId)
  return ids.some((id) => Number(id) === target)
}

function toLocalInput(iso) {
  return toMinskInput(iso)
}

function minskInputMillis(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return null
  const time = new Date(`${value}:00+03:00`).getTime()
  return Number.isNaN(time) ? null : time
}

function nightTimeError(startsAt, endsAt, deadline, now = new Date()) {
  const min = minskInputMillis(toMinskInput(now.toISOString()))
  const start = minskInputMillis(startsAt)
  const end = minskInputMillis(endsAt)
  if (start == null || end == null || min == null) return 'Укажите дату и время'
  if (start < min || end < min) return 'Нельзя указать прошедшее время'
  if (end <= start) return 'Конец должен быть позже начала'
  if (!deadline) return ''
  const limit = minskInputMillis(deadline)
  if (limit == null) {
    const day = String(deadline).slice(0, 10)
    const dayStart = /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00+03:00`).getTime() : NaN
    if (!Number.isNaN(dayStart) && dayStart < min) return 'Нельзя указать прошедшее время'
    return 'Укажите время дедлайна'
  }
  if (limit < min) return 'Нельзя указать прошедшее время'
  if (limit >= start) return 'Дедлайн записи должен быть раньше начала'
  return ''
}

function GameModal({ game, onClose, onSave }) {
  const [title, setTitle] = useState(game?.title || '')
  const [startsAt, setStartsAt] = useState(game ? toLocalInput(game.startsAt) : '')
  const [endsAt, setEndsAt] = useState(game?.endsAt ? toLocalInput(game.endsAt) : '')
  const [description, setDescription] = useState(game?.description || game?.place || '')
  const [deadline, setDeadline] = useState(game?.registrationDeadlineAt ? toLocalInput(game.registrationDeadlineAt) : '')
  const [seats, setSeats] = useState(game?.seats ?? '')
  const [kind, setKind] = useState(game?.kind || 'CLASSIC')
  const [price, setPrice] = useState(game?.price ?? 0)
  const [status, setStatus] = useState(game?.status || 'PUBLISHED')
  const [timeError, setTimeError] = useState('')
  const earliest = toMinskInput(new Date().toISOString())

  async function submit(event) {
    event.preventDefault()
    const message = nightTimeError(startsAt, endsAt, deadline)
    if (message) {
      setTimeError(message)
      return
    }
    setTimeError('')
    const ok = await onSave({
      title,
      startsAt,
      endsAt,
      description,
      registrationDeadlineAt: deadline || null,
      seats: Number(seats),
      kind,
      price: Number(price),
      status,
    })
    if (ok) onClose()
  }

  return (
    <Modal title={game ? 'Изменить вечер' : 'Новый вечер'} eyebrow="Вечера" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="название" required />
        <label htmlFor="night-start">Начало</label>
        <input id="night-start" type="datetime-local" min={earliest} value={startsAt} onChange={(event) => { setTimeError(''); setStartsAt(event.target.value) }} required />
        <label htmlFor="night-end">Конец</label>
        <input id="night-end" type="datetime-local" min={earliest} value={endsAt} onChange={(event) => { setTimeError(''); setEndsAt(event.target.value) }} required />
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="описание" rows={3} />
        <label htmlFor="night-deadline">Дедлайн записи</label>
        <input id="night-deadline" type="datetime-local" min={earliest} value={deadline} onChange={(event) => { setTimeError(''); setDeadline(event.target.value) }} />
        {timeError ? <p className="error">{timeError}</p> : null}
        <input type="number" min="1" value={seats} onChange={(event) => setSeats(event.target.value)} placeholder="мест" required />
        <select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="CLASSIC">Классика</option>
          <option value="NOVICE">Новички</option>
        </select>
        <input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="цена" required />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="DRAFT">Черновик</option>
          <option value="PUBLISHED">Опубликован</option>
        </select>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Отмена</button>
          <button type="submit">Сохранить</button>
        </div>
      </form>
    </Modal>
  )
}

const STATUS_BOOKING = {
  CONFIRMED: 'подтверждён',
  WAITING: 'ожидание',
}

export default function GamesScreen({ me, games, reloadKey = 0, onBook, onCreate, onUpdate, onCancelNight, onDeleteNight, onLogin, onResults, onTaken }) {
  const [kindFilter, setKindFilter] = useState('ALL')
  const [weekFilter, setWeekFilter] = useState('ALL')
  const [pending, setPending] = useState(null)
  const [booking, setBooking] = useState(false)
  const [bookedIds, setBookedIds] = useState([])
  const [bookingByGame, setBookingByGame] = useState({})
  const [bookResult, setBookResult] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [editor, setEditor] = useState(null)
  const [nightCancel, setNightCancel] = useState(null)
  const [nightCanceling, setNightCanceling] = useState(false)
  const [nightCancelError, setNightCancelError] = useState('')
  const [nightCancelDone, setNightCancelDone] = useState(false)
  const [nightDelete, setNightDelete] = useState(null)
  const [nightDeleting, setNightDeleting] = useState(false)
  const [nightDeleteError, setNightDeleteError] = useState('')
  const [nightDeleteDone, setNightDeleteDone] = useState(false)
  const [rosterGame, setRosterGame] = useState(null)
  const [roster, setRoster] = useState(null)
  const [rosterError, setRosterError] = useState('')
  const [rosterBusy, setRosterBusy] = useState(false)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const staff = me?.role === 'HOST'
  const eyebrow = staff ? 'Вечера' : 'Расписание'
  const title = me?.role === 'HOST' ? 'Управление ночами' : me ? 'Запись на вечер' : 'Вечера клуба'
  useEffect(() => {
    if (!me) {
      setBookedIds([])
      setBookingByGame({})
      return
    }
    let cancelled = false
    apiFetch('/api/bookings')
      .then((response) => (response.ok ? response.json() : []))
      .then((rows) => {
        if (cancelled) return
        const indexed = indexBookings(rows)
        setBookingByGame(indexed.map)
        setBookedIds(indexed.ids)
      })
      .catch(() => {
        if (!cancelled) {
          setBookingByGame({})
          setBookedIds([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [me, reloadKey])

  function openBooking(game) {
    if (isBooked(bookedIds, game.id)) return
    setBookResult(null)
    setPending(game)
  }

  function closeBooking() {
    if (booking) return
    setPending(null)
    setBookResult(null)
  }

  async function confirmBooking() {
    if (booking || !pending) return
    setBooking(true)
    try {
      const result = await onBook(pending.id)
      if (!result?.ok) {
        if (result?.error === 'уже записана') {
          const rows = await apiFetch('/api/bookings').then((response) => (response.ok ? response.json() : [])).catch(() => [])
          const indexed = indexBookings(rows)
          setBookingByGame(indexed.map)
          setBookedIds(indexed.ids)
        }
        setBookResult({ ok: false, error: result?.error || 'не вышло' })
        return
      }
      setBookedIds((ids) => (isBooked(ids, pending.id) ? ids : [...ids, Number(pending.id)]))
      if (result.id) {
        setBookingByGame((map) => ({ ...map, [pending.id]: result.id }))
      }
      setBookResult({ ok: true })
    } finally {
      setBooking(false)
    }
  }

  async function confirmNightCancel() {
    if (nightCanceling || !nightCancel) return
    if (!canCancelNight(nightCancel)) {
      setNightCancelError('вечер уже начался')
      return
    }
    setNightCanceling(true)
    setNightCancelError('')
    try {
      const result = await onCancelNight(nightCancel.id)
      if (!result.ok) {
        setNightCancelError(result.error || 'не вышло')
        return
      }
      setNightCancelDone(true)
    } finally {
      setNightCanceling(false)
    }
  }

  async function confirmNightDelete() {
    if (nightDeleting || !nightDelete || !onDeleteNight) return
    if (!canDeleteNight(nightDelete)) {
      setNightDeleteError('можно удалить только прошедший или отменённый вечер')
      return
    }
    setNightDeleting(true)
    setNightDeleteError('')
    try {
      const result = await onDeleteNight(nightDelete.id)
      if (!result?.ok) {
        setNightDeleteError(result?.error || 'не вышло')
        return
      }
      setNightDeleteDone(true)
    } finally {
      setNightDeleting(false)
    }
  }

  async function openRoster(game) {
    setRosterError('')
    setRoster(null)
    setRosterGame(game)
    try {
      const res = await apiFetch('/api/games/' + game.id + '/bookings')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRosterError(data.error || 'не вышло')
        return
      }
      setRoster(data)
    } catch {
      setRosterError('не вышло')
    }
  }

  function closeRoster() {
    if (rosterBusy) return
    setRemoveTarget(null)
    setRemoveError('')
    setRosterGame(null)
    setRoster(null)
    setRosterError('')
  }

  function askRemoveFromRoster(row) {
    if (rosterBusy || !rosterGame || !roster?.canEditRoster) return
    setRemoveError('')
    setRemoveTarget(row)
  }

  async function confirmRemoveFromRoster(reason) {
    if (rosterBusy || !rosterGame || !removeTarget || !roster?.canEditRoster) return
    setRosterBusy(true)
    setRemoveError('')
    setRosterError('')
    try {
      const res = await apiFetch('/api/games/' + rosterGame.id + '/bookings/' + removeTarget.id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRemoveError(data.error || 'не вышло')
        return
      }
      if (typeof data.taken === 'number') onTaken?.(rosterGame.id, data.taken)
      const removedId = removeTarget.id
      setRemoveTarget(null)
      const refreshed = await apiFetch('/api/games/' + rosterGame.id + '/bookings')
      const next = await refreshed.json().catch(() => null)
      if (refreshed.ok && next) setRoster(next)
      else {
        setRoster((current) => current
          ? { ...current, bookings: (current.bookings || []).filter((item) => item.id !== removedId) }
          : current)
      }
    } catch {
      setRemoveError('не вышло')
    } finally {
      setRosterBusy(false)
    }
  }

  async function confirmCancel() {
    if (canceling || !cancelTarget) return
    const bookingId = bookingByGame[cancelTarget.id]
    if (!bookingId) return
    setCanceling(true)
    setCancelError('')
    try {
      const res = await apiFetch('/api/bookings/' + bookingId, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCancelError(data.error || 'не вышло')
        return
      }
      setBookingByGame((map) => {
        const next = { ...map }
        delete next[cancelTarget.id]
        return next
      })
      setBookedIds((ids) => ids.filter((id) => Number(id) !== Number(cancelTarget.id)))
      setCancelTarget(null)
    } finally {
      setCanceling(false)
    }
  }

  const week = minskWeek()
  const visible = games.filter((game) => {
    if ((!me || me.role === 'PLAYER') && new Date(game.startsAt).getTime() <= Date.now()) return false
    if (kindFilter !== 'ALL' && game.kind !== kindFilter) return false
    if (weekFilter === 'WEEK' && !inMinskWeek(game.startsAt, week)) return false
    return true
  })

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {!me && <p className="lede">Выберите стол, проверьте места и запишитесь. Гостям доступен просмотр; запись — после входа.</p>}
        </div>
        {staff && (
          <button type="button" className="btn-primary" onClick={() => setEditor({ mode: 'create' })}>Новый вечер</button>
        )}
      </div>
      <div className="toolbar">
        {WEEKS.map((item) => (
          <button
            key={'week-' + item.id}
            type="button"
            className="chip"
            aria-current={weekFilter === item.id ? 'page' : undefined}
            onClick={() => setWeekFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="chip"
            aria-current={kindFilter === item.id ? 'page' : undefined}
            onClick={() => setKindFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="muted">{weekFilter === 'WEEK' ? 'На этой неделе вечеров нет' : 'пусто'}</p>
      )}
      <div className="night-list" key={reloadKey}>
      {visible.map((game) => {
        const when = nightParts(game.startsAt, game.endsAt)
        const mark = staff ? liveMark(game) : null
        return (
          <article key={game.id} className="night-card">
            <div className="night-card__when">
              <span>{when.label}</span>
              <span className="night-card__time">{when.time}</span>
            </div>
            <div>
              <h2 className="night-card__title">{game.title}</h2>
              <p className="muted">{KIND_LABEL[game.kind] || game.kind} · {game.taken ?? 0} из {game.seats}</p>
              {/* описание вечера видно в расписании, не только в форме ведущего */}
              {game.description ? <p>{game.description}</p> : null}
            </div>
            <div className="night-card__side">
              {game.price > 0 && <span className="price">{game.price} BYN</span>}
              {staff && canEditNight(game) && (
                <button type="button" className="btn-secondary btn-s" onClick={() => setEditor({ mode: 'edit', game })}>Изменить</button>
              )}
              {staff && canManageNight(game) && (
                <button type="button" className="btn-ghost btn-s" onClick={() => openRoster(game)}>Участники</button>
              )}
              {staff && canOpenResults(game) && (
                <button type="button" className="btn-primary btn-s" onClick={() => onResults(game)}>
                  {resultsButtonLabel(game)}
                </button>
              )}
              {staff && canCancelNight(game) && (
                <button
                  type="button"
                  className="btn-ghost btn-s"
                  onClick={() => { setNightCancelError(''); setNightCancelDone(false); setNightCancel(game) }}
                >
                  Отменить
                </button>
              )}
              {staff && canDeleteNight(game) && (
                <button
                  type="button"
                  className="btn-danger btn-s"
                  onClick={() => { setNightDeleteError(''); setNightDeleteDone(false); setNightDelete(game) }}
                >
                  Удалить
                </button>
              )}
              {!staff && isBooked(bookedIds, game.id) ? (
                <>
                  <button type="button" className="btn-primary btn-s" disabled>Вы записаны</button>
                  <button type="button" className="btn-ghost btn-s" onClick={() => { setCancelError(''); setCancelTarget(game) }}>Отменить</button>
                </>
              ) : !staff && game.status !== 'CANCELLED' && (
                <button
                  type="button"
                  className="btn-primary btn-s"
                  onClick={() => (me ? openBooking(game) : onLogin())}
                >
                  {bookLabel(game)}
                </button>
              )}
            </div>
            {staff && (
              <div className="night-card__tools">
                <span className={mark.className}>{mark.text}</span>
              </div>
            )}
          </article>
        )
      })}
      </div>
      {pending && (
        <Modal title={pending.title} eyebrow="Запись" onClose={closeBooking}>
          {bookResult ? (
            <>
              {bookResult.ok ? (
                <p>Вы записаны на игру</p>
              ) : bookResult.error === 'уже записана' ? (
                <p>Вы уже записаны</p>
              ) : bookResult.error === 'сначала войди' ? (
                <p className="muted">
                  Для записи, <a className="comment-login" href="/login" onClick={(event) => { event.preventDefault(); onLogin() }}>войдите</a> в свой аккаунт
                </p>
              ) : (
                <p className="error">вы не записались. {bookResult.error}</p>
              )}
              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={closeBooking}>Ок</button>
              </div>
            </>
          ) : (
            <>
              <p>{new Date(pending.startsAt).toLocaleString('ru')}</p>
              <p className="muted">{pending.place}</p>
              <p className="price">{pending.price > 0 ? `${pending.price} BYN` : '0 BYN'}</p>
              <p>{pending.taken ?? 0} из {pending.seats}</p>
              {(pending.taken ?? 0) >= pending.seats && <p>Свободных мест нет. Вы попадёте в лист ожидания.</p>}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={closeBooking} disabled={booking}>Отмена</button>
                <button type="button" className="btn-primary" onClick={confirmBooking} disabled={booking}>{bookLabel(pending)}</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {cancelTarget && (
        <CancelBookingDialog
          busy={canceling}
          error={cancelError}
          onClose={() => { if (!canceling) setCancelTarget(null) }}
          onConfirm={confirmCancel}
        />
      )}
      {nightCancel && (
        <Modal title={nightCancel.title} eyebrow="Отмена вечера" onClose={() => { if (!nightCanceling) setNightCancel(null) }}>
          {nightCancelDone ? (
            <>
              <p>Вечер отменён. Запись закрыта.</p>
              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={() => setNightCancel(null)}>Ок</button>
              </div>
            </>
          ) : (
            <>
              <p>Отменить вечер? Запись закроется, записанные игроки получат уведомление.</p>
              {nightCancelError ? <p className="error">{nightCancelError}</p> : null}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setNightCancel(null)} disabled={nightCanceling}>Нет</button>
                <button type="button" className="btn-primary" onClick={confirmNightCancel} disabled={nightCanceling}>Отменить</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {nightDelete && (
        <Modal title={nightDelete.title} eyebrow="Удаление вечера" onClose={() => { if (!nightDeleting) setNightDelete(null) }}>
          {nightDeleteDone ? (
            <>
              <p>Вечер удалён. Он исчез из расписания, сыгранных и рейтинга.</p>
              <div className="modal-actions">
                <button type="button" className="btn-primary" onClick={() => setNightDelete(null)}>Ок</button>
              </div>
            </>
          ) : (
            <>
              <p>Удалить вечер целиком? Пропадут записи, партии и вклад в рейтинг. Это нельзя отменить.</p>
              {nightDelete.resultsStatus === 'PUBLISHED' ? (
                <p className="muted">У этого вечера уже есть опубликованные результаты.</p>
              ) : null}
              {nightDeleteError ? <p className="error">{nightDeleteError}</p> : null}
              <div className="modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setNightDelete(null)} disabled={nightDeleting}>Нет</button>
                <button type="button" className="btn-danger" onClick={confirmNightDelete} disabled={nightDeleting}>Удалить</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {editor && (
        <GameModal
          game={editor.mode === 'edit' ? editor.game : null}
          onClose={() => setEditor(null)}
          onSave={(payload) => (editor.mode === 'edit' ? onUpdate(editor.game.id, payload) : onCreate(payload))}
        />
      )}
      {rosterGame && (
        <Modal title={rosterGame.title} eyebrow="Участники" onClose={closeRoster}>
          {rosterError ? <p className="error">{rosterError}</p> : null}
          {!roster ? (
            <p className="muted">загрузка…</p>
          ) : (
            <>
              <p className="muted">
                {roster.bookings?.length || 0} в списке · мест {roster.seats}
                {!roster.canEditRoster ? ' · снять нельзя (вечер начался или есть результаты)' : ''}
              </p>
              {!roster.bookings?.length ? (
                <p className="muted">пока никого нет</p>
              ) : (
                <div className="stack night-roster">
                  {roster.bookings.map((row) => (
                    <div key={row.id} className="night-roster__row">
                      <span>
                        {row.nick}
                        <span className="muted"> · {STATUS_BOOKING[row.status] || row.status}</span>
                      </span>
                      {roster.canEditRoster ? (
                        <button
                          type="button"
                          className="btn-ghost btn-s"
                          disabled={rosterBusy}
                          onClick={() => askRemoveFromRoster(row)}
                        >
                          Снять
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="modal-actions">
            <button type="button" className="btn-primary" onClick={closeRoster} disabled={rosterBusy}>Закрыть</button>
          </div>
        </Modal>
      )}
      {removeTarget && (
        <RemoveRosterDialog
          nick={removeTarget.nick}
          busy={rosterBusy}
          error={removeError}
          onClose={() => { if (!rosterBusy) { setRemoveTarget(null); setRemoveError('') } }}
          onConfirm={confirmRemoveFromRoster}
        />
      )}
    </section>
  )
}
