import { useTranslation } from 'react-i18next'
import AuthCard from '../components/AuthCard'

const ForgotPassword = () => {
  const { t } = useTranslation()
  return (
    <AuthCard title={t("Восстановление")} sideText={t("Вспомнили пароль?")} sideLink={t("Войти")} sidePath="/login">
      <form className="auth-form" onSubmit={event => event.preventDefault()}>
        <label>{t("Email")}<input type="email" placeholder={t("Email")} /></label>
        <button className="primary-button full" type="submit" disabled>{t("Отправить код")}</button>
      </form>
    </AuthCard>
  )
}

export default ForgotPassword
