import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const NotFound = () => {
  const { t } = useTranslation()
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>{t("Страница не найдена")}</p>
      <Link className="primary-link" to="/">{t("На главную")}</Link>
    </div>
  )
}

export default NotFound
