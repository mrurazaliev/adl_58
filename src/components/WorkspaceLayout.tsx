import { useTranslation } from 'react-i18next'
import { Suspense, useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import AppearanceControls from './AppearanceControls'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import AddDebtDialog, { DebtCreationContext } from './AddDebtDialog'
import SessionLoading from './SessionLoading'
import ContentSkeleton from './ContentSkeleton'
import type { DebtDirection } from '../types'
import api, { getErrorMessage } from '../api'
import type { CurrentUser } from '../types'

const links = [
  { to: '/dashboard', label: 'Панель управления', icon: <DashboardOutlinedIcon /> },
  { to: '/debts', label: 'Долги', icon: <AccountBalanceWalletOutlinedIcon /> },
  { to: '/archive', label: 'Архив', icon: <ArchiveOutlinedIcon /> },
  { to: '/contacts', label: 'Контакты', icon: <ContactsOutlinedIcon /> },
  { to: '/folders', label: 'Папки', icon: <FolderOutlinedIcon /> },
  { to: '/users', label: 'Пользователи', icon: <PeopleOutlineIcon /> }
]

type WorkspaceLayoutProps = {
  children: (user: CurrentUser | null) => ReactNode
}

const WorkspaceLayout = ({ children }: WorkspaceLayoutProps) => {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [debtOpen, setDebtOpen] = useState(false)
  const [debtDirection, setDebtDirection] = useState<DebtDirection>('they_owe_me')
  const [chooserOpen, setChooserOpen] = useState(false)
  const openAddDebt = (direction: DebtDirection = 'they_owe_me') => { setDebtDirection(direction); setDebtOpen(true); setChooserOpen(false) }

  useEffect(() => { setChooserOpen(false) }, [location.pathname])
  useEffect(() => {
    const expired = () => { setUser(null); setDebtOpen(false); setProfileOpen(false); navigate('/login', { replace: true }) }
    window.addEventListener('adl-session-expired', expired)
    return () => window.removeEventListener('adl-session-expired', expired)
  }, [navigate])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setSessionError('')
    api.session(controller.signal).then(response => {
      if (!controller.signal.aborted) setUser(response.data.user)
    }).catch(err => {
      if (!controller.signal.aborted) {
        setUser(null)
        if (err?.response?.status === 401) navigate('/login', { replace: true })
        else setSessionError(getErrorMessage(err))
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [navigate])

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setProfileError('')
    try {
      const response = await api.updateProfile(name.trim())
      setUser(response.data)
      setProfileOpen(false)
    } catch (err) { setProfileError(getErrorMessage(err)) } finally { setSaving(false) }
  }

  const logout = async () => {
    setSaving(true)
    setProfileError('')
    try {
      await api.logout()
      setUser(null)
      navigate('/login', { replace: true })
    } catch (err) { setProfileError(getErrorMessage(err)) } finally { setSaving(false) }
  }

  const title = links.find(link => location.pathname.startsWith(link.to))?.label || 'Adl 5:8'

  return (
    <DebtCreationContext.Provider value={openAddDebt}><div className="workspace">
      <aside id="workspace-sidebar" className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`} onKeyDown={event => event.key === 'Escape' && setMobileOpen(false)}>
        <div className="brand-row">
          <div className="brand-mark">5:8</div>
          {!collapsed && <span className="brand-name">Adl</span>}
          <button className="icon-button sidebar-toggle" aria-label={t("Свернуть или развернуть меню")} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>
            <MenuRoundedIcon />
          </button>
          <button className="icon-button mobile-menu sidebar-close" aria-label={t("Закрыть меню")} onClick={() => setMobileOpen(false)}><CloseRoundedIcon /></button>
        </div>

        <nav className="sidebar-nav">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              aria-label={t(link.label)}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              {link.icon}
              <span className="sidebar-link-label">{t(link.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-profile">
          <div className="avatar">A</div>
          {!collapsed && (
            <div>
              <strong>{user?.name || 'Adl 5:8'}</strong>
              <span>{user?.email || t("Профиль недоступен")}</span>
            </div>
          )}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-header">
          <div className="header-left">
            <button className="icon-button mobile-menu" aria-label={t("Открыть меню")} aria-controls="workspace-sidebar" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
              <MenuRoundedIcon />
            </button>
            <h1>{t(title)}</h1>
          </div>
          <div className="header-actions">
            <AppearanceControls />
            <button className="icon-button" disabled aria-label={t("Синхронизация пока недоступна")}><CheckCircleOutlineRoundedIcon /></button>
            <button className="icon-button" disabled aria-label={t("Уведомления пока недоступны")}><NotificationsNoneRoundedIcon /></button>
            <button className="avatar small" disabled={!user} aria-label={t("Текущий профиль")} onClick={() => { setName(user?.name || ''); setProfileError(''); setProfileOpen(true) }}>{user?.name.slice(0, 1).toUpperCase() || 'A'}</button>
          </div>
        </header>

        <main className="content" aria-busy={loading && !sessionError}>{loading ? <SessionLoading fullScreen={false} /> : sessionError ? <div className="request-state error-state" role="alert"><strong>{t(sessionError)}</strong><button className="secondary-button" onClick={() => window.location.reload()}>{t("Повторить")}</button><Link to="/login">{t("Перейти ко входу")}</Link></div> : user ? <Suspense fallback={<ContentSkeleton variant={location.pathname === '/dashboard' ? 'dashboard' : location.pathname === '/folders' ? 'folders' : 'table'} />}>{children(user)}</Suspense> : null}</main>

        {chooserOpen && <div className="fab-chooser" role="menu" aria-label={t('Добавить долг')} onKeyDown={event => event.key === 'Escape' && setChooserOpen(false)}><button autoFocus role="menuitem" onClick={() => openAddDebt('they_owe_me')}>{t('Мне должны')}</button><button role="menuitem" onClick={() => openAddDebt('i_owe_them')}>{t('Я должен')}</button></div>}
        <button className="fab" disabled={loading || !user || !['/dashboard', '/debts'].includes(location.pathname)} aria-label={t('Добавить долг')} aria-expanded={chooserOpen} aria-haspopup="menu" onClick={() => setChooserOpen(value => !value)}>
          <AddRoundedIcon />
        </button>
      </div>
      {profileOpen && user && <div className="modal-backdrop"><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="current-profile-title"><div className="modal-heading"><h3 id="current-profile-title">{t("Текущий профиль")}</h3><button className="icon-button" disabled={saving} onClick={() => setProfileOpen(false)} aria-label={t("Закрыть")}>×</button></div><form className="contact-form" onSubmit={saveProfile}><label>{t("Имя")}<input value={name} onChange={event => setName(event.target.value)} required disabled={saving} /></label><p>{user.email}</p>{profileError && <div className="form-error" role="alert">{t(profileError)}</div>}<div className="modal-actions"><button className="secondary-button" type="button" onClick={logout} disabled={saving}>{t("Выйти")}</button><button className="primary-button" disabled={saving}>{t("Сохранить")}</button></div></form></div></div>}
      {debtOpen && <AddDebtDialog direction={debtDirection} onClose={() => setDebtOpen(false)} onCreated={() => setDebtOpen(false)} />}
    </div></DebtCreationContext.Provider>
  )
}

export default WorkspaceLayout
