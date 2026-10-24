import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import AuthCard from '../components/AuthCard'
import { useState, type FormEvent } from 'react'
import api, { getErrorMessage } from '../api'

const Login = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const enterLive = async (event?: FormEvent) => {
    event?.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (event) await api.login(email.trim(), password)
      await api.session()
      setPassword('')
      navigate('/dashboard')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthCard title={t("Вход")} sideText={t("Нет аккаунта?")} sideLink={t("Регистрация")} sidePath="/register">
      <form className="auth-form" onSubmit={enterLive}>
        <label>{t("Email")}<input type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={saving} /></label>
        <label>{t("Пароль")}<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={saving} /></label>
        <div className="auth-form-row"><Link to="/forgot-password">{t("Забыли пароль?")}</Link></div>
        {error && <div className="form-error" role="alert">{t(error)}</div>}
        <button className="primary-button full" type="submit" disabled={saving}>{saving ? t("Проверка сессии…") : t("Войти")}</button>
        <button className="secondary-button full" type="button" disabled={saving} onClick={() => enterLive()}>{t('Продолжить сессию')}</button>
      </form>
    </AuthCard>
  )
}

export default Login
