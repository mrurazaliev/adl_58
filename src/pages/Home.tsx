import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import AppearanceControls from '../components/AppearanceControls'
import AccountBalanceWalletOutlined from '@mui/icons-material/AccountBalanceWalletOutlined'
import ContactsOutlined from '@mui/icons-material/ContactsOutlined'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined'
import SwapHorizOutlined from '@mui/icons-material/SwapHorizOutlined'
import FileDownloadOutlined from '@mui/icons-material/FileDownloadOutlined'

const features = [
  { title: 'Долги', description: 'Храните суммы, направления и сроки долгов.', icon: AccountBalanceWalletOutlined },
  { title: 'Контакты', description: 'Находите нужный контакт и связанные с ним записи.', icon: ContactsOutlined },
  { title: 'Папки', description: 'Группируйте контакты и просматривайте итоги.', icon: FolderOutlined },
  { title: 'Платежи', description: 'Записывайте платежи и просматривайте их историю.', icon: PaymentsOutlined },
  { title: 'Чистый итог', description: 'Следите за балансом в каждом направлении.', icon: SwapHorizOutlined },
  { title: 'Экспорт', description: 'Сохраняйте выбранные записи в CSV.', icon: FileDownloadOutlined }
]
const steps = [
  { title: 'Создайте аккаунт', description: 'Зарегистрируйтесь или войдите в свой аккаунт.' },
  { title: 'Добавьте контакт', description: 'Выберите человека для учёта взаимных расчётов.' },
  { title: 'Запишите долг', description: 'Укажите сумму, направление и при необходимости срок.' },
  { title: 'Учитывайте платежи', description: 'Записывайте операции и проверяйте актуальный баланс.' }
]

const Home = () => {
  const { t } = useTranslation()
  return (
    <div className="public-page">
      <header className="public-header">
        <Link to="/" className="public-brand"><span>5:8</span> Adl</Link>
        <div className="public-controls">
          <AppearanceControls />
          <Link className="text-link" to="/register">{t("Регистрация")}</Link>
          <Link className="outline-link" to="/login">{t("Войти")}</Link>
        </div>
      </header>
      <main>
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">{t("Управление долгами и финансами")}</p>
        <h1 id="home-title">{t("Контролируйте долги.")}<br />{t("Сохраняйте ясность.")}</h1>
        <p>{t('Долги, контакты и платежи в одном месте.')}</p>
        <div className="hero-actions">
          <Link className="primary-link" to="/login">{t("Начать бесплатно")}</Link>
          <Link className="secondary-link" to="/register">{t("Создать аккаунт")}</Link>
        </div>
        <div className="badge-row">
          <span>{t("Долги")}</span><span>{t("Контакты")}</span><span>{t("Папки")}</span><span>RU · TJ · EN</span>
        </div>
      </section>
      <section className="landing-section" aria-labelledby="features-title">
        <div className="landing-section-heading"><p className="eyebrow">Adl 5:8</p><h2 id="features-title">{t('Всё необходимое для учёта долгов')}</h2></div>
        <div className="landing-feature-grid">{features.map(({ title, description, icon: Icon }) => <article className="landing-feature" key={title}><Icon aria-hidden="true" /><h3>{t(title)}</h3><p>{t(description)}</p></article>)}</div>
      </section>
      <section className="landing-section landing-info" aria-labelledby="info-title">
        <h2 id="info-title">{t('Привычный формат работы')}</h2>
        <div className="landing-info-grid"><div><strong>3</strong><span>{t('Языка интерфейса')}</span><small>RU · TJ · EN</small></div><div><strong>2</strong><span>{t('Темы оформления')}</span><small>{t('Тёмная')} / {t('Светлая')}</small></div><div><strong>CSV</strong><span>{t('Экспорт записей')}</span><small>{t('Данные под рукой')}</small></div></div>
      </section>
      <section className="landing-section" aria-labelledby="steps-title">
        <div className="landing-section-heading"><h2 id="steps-title">{t('Как начать работу')}</h2><p>{t('Четыре простых шага')}</p></div>
        <ol className="landing-step-grid">{steps.map((step, index) => <li key={step.title}><span className="landing-step-number" aria-hidden="true">{index + 1}</span><h3>{t(step.title)}</h3><p>{t(step.description)}</p></li>)}</ol>
      </section>
      <section className="landing-section landing-final" aria-labelledby="final-title"><h2 id="final-title">{t('Начните с ясного баланса')}</h2><p>{t('Долги, контакты и платежи в одном месте.')}</p><div className="hero-actions"><Link className="primary-link" to="/login">{t('Начать бесплатно')}</Link><Link className="secondary-link" to="/register">{t('Создать аккаунт')}</Link></div></section>
      </main>
      <footer className="public-footer"><Link className="public-brand" to="/"><span>5:8</span> Adl</Link><p>© {new Date().getFullYear()} Adl 5:8</p><nav aria-label={t('Навигация внизу страницы')}><Link to="/">{t('Главная')}</Link><Link to="/login">{t('Войти')}</Link><Link to="/register">{t('Регистрация')}</Link></nav></footer>
    </div>
  )
}

export default Home
