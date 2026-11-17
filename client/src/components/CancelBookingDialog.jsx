import Modal from './Modal'

export default function CancelBookingDialog({ onConfirm, onClose, busy, error }) {
  return (
    <Modal title="Отмена записи" eyebrow="Запись" onClose={onClose}>
      <p>Вы точно хотите отменить запись?</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="modal-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>Нет</button>
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>Отменить</button>
      </div>
    </Modal>
  )
}
