import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { messages } from './translations'

const readLanguage = () => {
  try { return localStorage.getItem('adl-language') } catch { return null }
}
const saved = readLanguage()
const language = saved && ['ru', 'tg', 'en'].includes(saved) ? saved : 'ru'
const entries = Object.entries(messages)

i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: { ...Object.fromEntries(entries.map(([key]) => [key, key])), Poor: 'Слабый', 'Network Error': 'Ошибка сети' } },
    tg: { translation: Object.fromEntries(entries.map(([key, values]) => [key, values[0]])) },
    en: { translation: Object.fromEntries(entries.map(([key, values]) => [key, values[1]])) }
  },
  lng: language,
  fallbackLng: 'ru',
  supportedLngs: ['ru', 'tg', 'en'],
  showSupportNotice: false,
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  initImmediate: false
})

const applyLanguage = (value: string) => {
  if (typeof document !== 'undefined') document.documentElement.lang = value
  try { localStorage.setItem('adl-language', value) } catch {}
}
i18n.on('languageChanged', applyLanguage)
applyLanguage(language)

export const locale = () => i18n.resolvedLanguage === 'en' ? 'en-US' : i18n.resolvedLanguage === 'tg' ? 'tg-TJ' : 'ru-RU'
export default i18n
