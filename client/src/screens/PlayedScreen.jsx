import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

const FORMAT_LABEL = {
  CLASSIC: 'Классика',
  NOVICE: 'Новички',
}

const ROLE_LABEL = {
  CIVILIAN: 'мирный',
  SHERIFF: 'шериф',
  MAFIA: 'мафия',
  DON: 'дон',
}

const SIDE_LABEL = {
  CITY: 'мирный город',
  MAFIA: 'мафия',
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
const DAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб']
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function minskParts(iso) {
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

function nightWhen(iso) {
  const value = minskParts(iso)
  if (!value) return { date: '', time: '' }
  return {
    date: `${DAYS[WEEKDAY[value('weekday')]]} ${Number(value('day'))} ${MONTHS[Number(value('month')) - 1]}`,
    time: `${value('hour')}:${value('minute')}`,
  }
}

function showPoints(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100)
}

function roleText(player) {
  if (player.attendance === 'SKIPPED') return 'пропустил'
  return ROLE_LABEL[player.role] || player.role || '—'
}

function rankedTotals(list) {
  return [...(list || [])]
    .sort((a, b) => Number(b.total) - Number(a.total))
    .map((row, index) => ({ ...row, place: index + 1 }))
}

export default function PlayedScreen({ focusId = null }) {
  const [rows, setRows] = useState(null)
  const [openId, setOpenId] = useState(focusId || null)
  const [detail, setDetail] = useState(null)
  const [partiesOpen, setPartiesOpen] = useState(false)
  const [error, setError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [detailBusy, setDetailBusy] = useState(false)

  useEffect(() => {
    if (focusId) setOpenId(focusId)
  }, [focusId])

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/played')
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) {
          setRows([])
          setError('не вышло загрузить сыгранные')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!openId) {
      setDetail(null)
      setDetailError('')
      setPartiesOpen(false)
      return undefined
    }
    let cancelled = false
    setDetailBusy(true)
    setDetail(null)
    setDetailError('')
    setPartiesOpen(false)
    apiFetch('/api/played/' + openId)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setDetail(data)
      })
      .catch(() => {
        if (!cancelled) setDetailError('не вышло открыть результаты')
      })
      .finally(() => {
        if (!cancelled) setDetailBusy(false)
      })
    return () => {
      cancelled = true
    }
  }, [openId])

  function toggle(id) {
    setOpenId((current) => (current === id ? null : id))
  }

  return (
    <section className="screen">
      <div className="page-head">
        <div>
          <p className="eyebrow">Архив</p>
          <h1>Сыгранные</h1>
          <p className="lede">Опубликованные результаты вечеров — только чтение.</p>
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {rows == null ? <p className="muted">загрузка…</p> : null}
      {rows && rows.length === 0 && !error ? <p className="muted">пока нет опубликованных вечеров</p> : null}
      <div className="played-list">
        {(rows || []).map((night) => {
          const when = nightWhen(night.startsAt)
          const open = openId === night.id
          return (
            <article key={night.id} className={`played-card${open ? ' played-card--open' : ''}`}>
              <button type="button" className="played-card__head" onClick={() => toggle(night.id)} aria-expanded={open}>
                <div className="played-card__when">
                  <span>{when.date}</span>
                  <span className="played-card__time">{when.time}</span>
                </div>
                <div className="played-card__meta">
                  <h2 className="played-card__title">{night.title}</h2>
                  <p className="muted">
                    {FORMAT_LABEL[night.format] || night.format}
                    {night.partyCount ? ` · партий ${night.partyCount}` : ''}
                  </p>
                </div>
                <span className="played-card__chev" aria-hidden="true">{open ? '−' : '+'}</span>
              </button>
              {open ? (
                <div className="played-card__body">
                  {detailBusy ? <p className="muted">загрузка…</p> : null}
                  {detailError ? <p className="error">{detailError}</p> : null}
                  {detail && detail.night?.id === night.id ? (
                    <div className="played-detail">
                      <section className="night-rank">
                        <h3 className="night-rank__title">Рейтинг вечера</h3>
                        <table className="night-rank__table">
                          <thead>
                            <tr>
                              <th scope="col">Место</th>
                              <th scope="col">Игрок</th>
                              <th scope="col">Очки</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rankedTotals(detail.totals).map((row) => (
                              <tr key={row.key || row.label}>
                                <td className="night-rank__place">{row.place}</td>
                                <td className="night-rank__nick">
                                  {row.label}
                                  {row.kind === 'GUEST' ? <span className="muted"> · гость</span> : null}
                                </td>
                                <td className="night-rank__pts">{showPoints(row.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!detail.totals?.length ? <p className="muted">нет очков за вечер</p> : null}
                      </section>
                      <div className="played-detail__actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          aria-expanded={partiesOpen}
                          onClick={() => setPartiesOpen((open) => !open)}
                        >
                          {partiesOpen ? 'Скрыть' : 'Подробнее'}
                        </button>
                      </div>
                      {partiesOpen ? (
                        <div className="played-parties">
                          {(detail.parties || []).map((party, index) => (
                            <section key={party.id || index} className="played-party">
                              <header className="played-party__head">
                                <h3>Партия {party.partyNumber || index + 1}</h3>
                                <p className="played-party__side">
                                  победа: {SIDE_LABEL[party.winningSide] || party.winningSide || '—'}
                                </p>
                              </header>
                              <ul className="played-players">
                                {(party.players || []).map((player) => (
                                  <li key={player.id || `${party.id}-${player.label}`}>
                                    <span className="played-players__nick">
                                      {player.label}
                                      {player.kind === 'GUEST' ? <span className="muted"> · гость</span> : null}
                                    </span>
                                    <span className="played-players__role">{roleText(player)}</span>
                                    <span className="played-players__pts">{showPoints(player.total)}</span>
                                  </li>
                                ))}
                              </ul>
                            </section>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
