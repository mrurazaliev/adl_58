import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import NotFound from './pages/NotFound'
import './index.css'
import './i18n'
import './theme'
import { useTranslation } from 'react-i18next'
import SessionLoading from './components/SessionLoading'

const RouteError = () => {
  const { t } = useTranslation()
  return <div className="not-found" role="alert"><h1>{t('Ошибка')}</h1><p>{t('Не удалось открыть страницу.')}</p><a className="secondary-link" href="/">{t('На главную')}</a></div>
}

const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Debts = lazy(() => import('./pages/Debts'))
const Archive = lazy(() => import('./pages/Archive'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Folders = lazy(() => import('./pages/Folders'))
const Users = lazy(() => import('./pages/Users'))

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'debts', element: <Debts /> },
      { path: 'archive', element: <Archive /> },
      { path: 'contacts', element: <Contacts /> },
      { path: 'folders', element: <Folders /> },
      { path: 'users', element: <Users /> },
      { path: '*', element: <NotFound /> }
    ]
  }
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<SessionLoading label="Загрузка страницы…" />}><RouterProvider router={router} /></Suspense>
  </StrictMode>
)
