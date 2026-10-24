import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { lazy, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api, { getErrorMessage } from './api'
import SessionLoading from './components/SessionLoading'

const WorkspaceLayout = lazy(() => import('./components/WorkspaceLayout'))

const workspaceRoutes = ['/dashboard', '/debts', '/archive', '/contacts', '/folders', '/users']

const App = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [checkedPath, setCheckedPath] = useState('')
  const sessionRoute = ['/', '/login', '/register'].includes(location.pathname)
  useEffect(() => {
    if (!['/', '/login', '/register'].includes(location.pathname)) { setChecking(false); return }
    const controller = new AbortController()
    setChecking(true)
    setError('')
    api.session(controller.signal).then(() => {
      if (!controller.signal.aborted) navigate('/dashboard', { replace: true })
    }).catch(err => {
      if (controller.signal.aborted) return
      if (err?.response?.status !== 401) setError(getErrorMessage(err))
    }).finally(() => { if (!controller.signal.aborted) { setCheckedPath(location.pathname); setChecking(false) } })
    return () => controller.abort()
  }, [location.pathname, navigate])
  const isWorkspace = workspaceRoutes.some(route => location.pathname === route || location.pathname === `${route}/`)

  if (sessionRoute && (checking || checkedPath !== location.pathname)) return <SessionLoading />
  if (error && sessionRoute) return <div className="session-loading error-state" role="alert"><strong>{t(error)}</strong><button className="secondary-button" onClick={() => window.location.reload()}>{t('Повторить')}</button></div>

  if (isWorkspace) {
    return (
      <WorkspaceLayout>
        {user => <Outlet context={user} />}
      </WorkspaceLayout>
    )
  }

  return <Outlet />
}

export default App
