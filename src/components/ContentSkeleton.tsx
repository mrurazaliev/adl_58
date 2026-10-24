import Skeleton from '@mui/material/Skeleton'
import { useTranslation } from 'react-i18next'

type Variant = 'summary' | 'table' | 'folders' | 'dashboard'

const ContentSkeleton = ({ variant }: { variant: Variant }) => {
  const { t } = useTranslation()
  const summary = <div className="summary-grid">{Array.from({ length: 3 }, (_, index) => <div className="summary-card" key={index}><Skeleton width="45%" height={24} /><Skeleton width="70%" height={48} /></div>)}</div>
  return <div className="content-skeleton" role="status" aria-busy="true" aria-label={t('Загрузка данных…')}>
    <span className="visually-hidden">{t('Загрузка данных…')}</span>
    <div aria-hidden="true">
      {(variant === 'summary' || variant === 'dashboard') && summary}
      {variant === 'table' && <div className="loading-table">{Array.from({ length: 5 }, (_, index) => <div className="loading-table-row" key={index}><Skeleton width="34%" height={26} /><Skeleton width="22%" height={26} /><Skeleton width="17%" height={26} /><Skeleton width="12%" height={26} /></div>)}</div>}
      {variant === 'folders' && <div className="folder-grid">{Array.from({ length: 3 }, (_, index) => <div className="folder-card loading-folder" key={index}><Skeleton width="45%" height={30} />{Array.from({ length: 3 }, (_, row) => <div className="loading-folder-row" key={row}><Skeleton width="40%" height={24} /><Skeleton width="25%" height={24} /></div>)}</div>)}</div>}
      {variant === 'dashboard' && <div className="dashboard-grid loading-dashboard"><section className="panel chart-panel"><Skeleton width="40%" height={30} /><Skeleton variant="rounded" height={300} sx={{ mt: 3 }} /></section><section className="panel recent-panel"><Skeleton width="65%" height={30} />{Array.from({ length: 4 }, (_, index) => <div className="loading-payment" key={index}><Skeleton variant="circular" width={34} height={34} /><Skeleton width="65%" height={48} /></div>)}</section></div>}
    </div>
  </div>
}

export default ContentSkeleton
