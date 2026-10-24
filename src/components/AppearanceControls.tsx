import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import { getTheme, setTheme } from '../theme'

const AppearanceControls = () => {
  const { t, i18n } = useTranslation()
  const [theme, updateTheme] = useState(getTheme)
  const label = theme === 'dark' ? t('Переключить на светлую тему') : t('Переключить на тёмную тему')

  return (
    <div className="appearance-controls">
      <select aria-label={t('Язык')} value={i18n.resolvedLanguage || 'ru'} onChange={event => i18n.changeLanguage(event.target.value)}>
        <option value="ru">RU</option><option value="tg">TJ</option><option value="en">EN</option>
      </select>
      <Tooltip title={label}>
        <IconButton size="small" aria-label={label} onClick={() => { const value = theme === 'dark' ? 'light' : 'dark'; setTheme(value); updateTheme(value) }} sx={{ color: 'var(--text)', width: 36, height: 36 }}>
          {theme === 'dark' ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
        </IconButton>
      </Tooltip>
    </div>
  )
}

export default AppearanceControls
