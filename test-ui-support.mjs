export const locale = () => 'ru-RU'
export const useTranslation = () => ({ t: (key, values = {}) => String(key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? '')), i18n: { resolvedLanguage: 'ru' } })
