import { useEffect, useState } from 'react'
import { apiFetch } from '../api'

function passwordMeetsRules(password) {
  return (
    password.length >= 8 &&
    /\d/.test(password) &&
    /[A-ZА-ЯЁ]/.test(password) &&
    /[^0-9A-Za-zА-Яа-яЁё]/.test(password)
  )
}

export default function ProfileScreen({ me, onAccount }) {
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(me?.email || '')
  const [nick, setNick] = useState(me?.nick || '')
  const [login, setLogin] = useState(me?.login || me?.email || '')
  const [accountError, setAccountError] = useState('')
  const [accountNote, setAccountNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordNote, setPasswordNote] = useState('')
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        setPhone(data.phone || '')
        setEmail(data.email || '')
        setNick(data.nick || '')
        setLogin(data.login || data.email || '')
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!me) return null

  function changeEmail(value) {
    setAccountError('')
    setAccountNote('')
    setEmail(value)
    setLogin(value)
  }

  async function saveAccount(event) {
    event.preventDefault()
    if (saving) return
    setAccountError('')
    setAccountNote('')
    if (!nick.trim() || !email.trim() || !login.trim()) {
      setAccountError('Заполни поля')
      return
    }
    if (login.trim() !== email.trim()) {
      setAccountError('Логин должен совпадать с email')
      return
    }
    setSaving(true)
    try {
      const response = await apiFetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nick, email, phone, login }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setAccountError(data.error || 'не вышло')
        return
      }
      setPhone(data.phone || '')
      setEmail(data.email || '')
      setNick(data.nick || '')
      setLogin(data.login || data.email || '')
      onAccount?.(data)
      setAccountNote('Сохранено')
    } catch {
      setAccountError('не вышло')
    } finally {
      setSaving(false)
    }
  }

  async function savePassword(event) {
    event.preventDefault()
    if (changing) return
    setPasswordError('')
    setPasswordNote('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Заполни поля')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпали')
      return
    }
    if (!passwordMeetsRules(newPassword)) {
      setPasswordError('Пароль не соответствует требованиям: минимум 8 символов, цифра, заглавная буква и спецсимвол')
      return
    }
    setChanging(true)
    try {
      const response = await apiFetch('/api/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirm: confirmPassword,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPasswordError(data.error || 'не вышло')
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordNote('Пароль изменён')
    } catch {
      setPasswordError('не вышло')
    } finally {
      setChanging(false)
    }
  }

  return (
    <section className="screen">
      <p className="eyebrow">Профиль</p>
      <h1>Профиль</h1>
      <div className="profile-grid">
        <form className="stack profile-form" onSubmit={saveAccount}>
          <h2 className="profile-form__title">Аккаунт</h2>
          <label>
            Телефон
            <input value={phone} onChange={(event) => { setAccountError(''); setAccountNote(''); setPhone(event.target.value) }} />
          </label>
          <label>
            Email
            <input type="email" value={email} onChange={(event) => changeEmail(event.target.value)} required />
          </label>
          <label>
            Ник
            <input value={nick} onChange={(event) => { setAccountError(''); setAccountNote(''); setNick(event.target.value) }} required />
          </label>
          <label>
            Логин
            <input type="email" value={login} onChange={(event) => changeEmail(event.target.value)} required />
          </label>
          {accountError ? <p className="error">{accountError}</p> : null}
          {accountNote ? <p className="muted">{accountNote}</p> : null}
          <button type="submit" className="btn-primary" disabled={saving}>Сохранить</button>
        </form>
        <form className="stack profile-form" onSubmit={savePassword}>
          <h2 className="profile-form__title">Смена пароля</h2>
          <label>
            Текущий пароль
            <input type="password" value={currentPassword} onChange={(event) => { setPasswordError(''); setPasswordNote(''); setCurrentPassword(event.target.value) }} />
          </label>
          <label>
            Новый пароль
            <input type="password" value={newPassword} onChange={(event) => { setPasswordError(''); setPasswordNote(''); setNewPassword(event.target.value) }} />
          </label>
          <label>
            Повторите пароль
            <input type="password" value={confirmPassword} onChange={(event) => { setPasswordError(''); setPasswordNote(''); setConfirmPassword(event.target.value) }} />
          </label>
          {passwordError ? <p className="error">{passwordError}</p> : null}
          {passwordNote ? <p className="muted">{passwordNote}</p> : null}
          <button type="submit" className="btn-primary" disabled={changing}>Сменить пароль</button>
        </form>
      </div>
    </section>
  )
}
