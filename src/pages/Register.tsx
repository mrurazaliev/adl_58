import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import api, { getErrorMessage } from '../api'

const Register = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const register = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await api.register(name.trim(), email.trim(), password)
      await api.session()
      setPassword('')
      navigate('/dashboard', { replace: true })
    } catch (err) { setError(getErrorMessage(err)) } finally { setSaving(false) }
  }

  return <AuthCard title={t('Регистрация')} sideText={t('Уже есть аккаунт?')} sideLink={t('Войти')} sidePath="/login">
    <form className="auth-form" onSubmit={register}>
      <label>{t('Имя')}<input value={name} onChange={event => setName(event.target.value)} maxLength={120} autoComplete="name" required disabled={saving} /></label>
      <label>{t('Email')}<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required disabled={saving} /></label>
      <label>{t('Пароль')}<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required disabled={saving} /></label>
      {error && <div className="form-error" role="alert">{t(error)}</div>}
      <button className="primary-button full" type="submit" disabled={saving}>{saving ? t('Сохранение…') : t('Создать аккаунт')}</button>
    </form>
  </AuthCard>
}

export default Register
