import { useEffect } from 'react'

export default function Modal({ title, eyebrow, onClose, children, showClose = false }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={showClose ? 'modal modal--close' : 'modal'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {showClose ? (
          <button type="button" className="modal-close" aria-label="Закрыть" onClick={onClose}>×</button>
        ) : null}
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
