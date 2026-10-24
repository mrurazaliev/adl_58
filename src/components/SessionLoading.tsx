import CircularProgress from '@mui/material/CircularProgress'
import { useTranslation } from 'react-i18next'

const SessionLoading = ({ fullScreen = true, label = 'Проверка сессии…' }: { fullScreen?: boolean; label?: string }) => {
  const { t } = useTranslation()
  return <div className={fullScreen ? 'session-loading' : 'session-loading inline-loading'} role="status" aria-busy="true">
    <span className="loading-brand" aria-hidden="true">5:8</span>
    <CircularProgress size={30} thickness={3.5} color="inherit" aria-hidden="true" />
    <span>{t(label)}</span>
  </div>
}

export default SessionLoading
