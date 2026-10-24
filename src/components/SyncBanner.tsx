import { useTranslation } from 'react-i18next'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'

const SyncBanner = () => {
  const { t } = useTranslation()
  return (
    <div className="sync-banner">
      <div>
        <strong>{t("Синхронизация ожидает backend-контракт")}</strong>
        <span>{t("Интерфейс сохранён по оригиналу, но pending queue пока не выдумывается")}</span>
      </div>
      <div className="sync-actions">
        <button className="icon-button" disabled aria-label={t("Синхронизация пока недоступна")}>
          <SyncRoundedIcon />
        </button>
      </div>
    </div>
  )
}

export default SyncBanner
