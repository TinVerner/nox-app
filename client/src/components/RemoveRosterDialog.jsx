import { useState } from 'react'
import Modal from './Modal'

export default function RemoveRosterDialog({ nick, onConfirm, onClose, busy, error }) {
  const [reason, setReason] = useState('')

  function submit(event) {
    event.preventDefault()
    const trimmed = reason.trim()
    if (!trimmed || busy) return
    onConfirm(trimmed)
  }

  return (
    <Modal title="Снять с записи" eyebrow="Участники" onClose={onClose}>
      <p>Точно снять игрока?</p>
      {nick ? <p className="muted">{nick}</p> : null}
      <form className="stack" onSubmit={submit}>
        <label>
          Причина снятия
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="причина снятия"
            rows={3}
            required
            disabled={busy}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Нет</button>
          <button type="submit" className="btn-danger" disabled={busy || !reason.trim()}>Снять</button>
        </div>
      </form>
    </Modal>
  )
}
