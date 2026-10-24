export type Theme = 'dark' | 'light'

export const getTheme = (): Theme => {
  try { return localStorage.getItem('adl-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' }
}

export const setTheme = (theme: Theme) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
  }
  try { localStorage.setItem('adl-theme', theme) } catch {}
}

setTheme(getTheme())
