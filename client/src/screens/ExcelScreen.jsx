import { useRef, useState } from 'react'
import { apiFetch } from '../api'

export default function ExcelScreen() {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  async function downloadExport() {
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const res = await apiFetch('/api/excel/export')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'не вышло выгрузить')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'nox-club.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  async function uploadImport(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await apiFetch('/api/excel/import', { method: 'POST', body })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'не вышло загрузить')
        return
      }
      setResult(data)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="screen">
      <p className="eyebrow">Управление клубом</p>
      <h1>Excel</h1>
      <p className="lede">
        Выгрузка и загрузка пользователей, игровых вечеров и записей. Импорт обновляет и добавляет строки, существующие данные не стирает.
      </p>
      <div className="panel stack">
        <button type="button" className="btn-primary" disabled={busy} onClick={downloadExport}>
          Скачать .xlsx
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          Загрузить .xlsx
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={uploadImport}
        />
        {error ? <p className="error">{error}</p> : null}
      </div>
      {result ? (
        <div className="stack form-follow">
          <article className="panel">
            <h2>Результат импорта</h2>
            <p className="muted">
              Пользователи: +{result.users?.created || 0} / ≈{result.users?.updated || 0} / −{result.users?.skipped || 0}
            </p>
            <p className="muted">
              Вечера: +{result.game_nights?.created || 0} / ≈{result.game_nights?.updated || 0} / −{result.game_nights?.skipped || 0}
            </p>
            <p className="muted">
              Записи: +{result.bookings?.created || 0} / ≈{result.bookings?.updated || 0} / −{result.bookings?.skipped || 0}
            </p>
            {(result.passwords || []).length > 0 ? (
              <>
                <p className="muted">Пароли новых аккаунтов — показываются один раз, передайте их игрокам:</p>
                <ul className="stack">
                  {result.passwords.map((row) => (
                    <li key={row.email}><code>{row.email}</code> — <code>{row.password}</code></li>
                  ))}
                </ul>
              </>
            ) : null}
            {(result.errors || []).length > 0 ? (
              <ul className="stack">
                {result.errors.slice(0, 12).map((line) => (
                  <li key={line} className="error">{line}</li>
                ))}
              </ul>
            ) : (
              <p className="muted">Без ошибок.</p>
            )}
          </article>
        </div>
      ) : null}
    </section>
  )
}
