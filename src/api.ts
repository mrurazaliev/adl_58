import axios from 'axios'
import { demoRequest, disableDemoMode, isDemoMode } from './demoStore'
import type { CurrentUser } from './types'

const liveApi = axios.create({
  baseURL: '/api',
  timeout: 35000
})

type ApiResult<T> = Promise<{ data: T; status: number }>

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown) => typeof value === 'string'
const optionalText = (value: unknown) => value == null || text(value)
const positiveAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0
const validUser = (value: unknown) => record(value) && text(value.id) && text(value.name) && text(value.email) && optionalText(value.created_at)

const validateResponse = (method: string, path: string, value: unknown, status: number) => {
  let valid = false
  if (method === 'DELETE') {
    valid = status === 204
  } else if (path === '/auth/session' || path === '/auth/login' || path === '/auth/register') {
    valid = record(value) && validUser(value.user)
  } else if (path === '/users/me') {
    valid = validUser(value)
  } else if (path === '/auth/logout') {
    valid = record(value) && text(value.message)
  } else {
    const parts = path.split('/').filter(Boolean)
    const kind = parts[2] === 'payments' ? 'payments' : parts[0]
    const validItem = (item: unknown) => {
      if (!record(item) || !text(item.id) || !item.id || !optionalText(item.created_at) || !optionalText(item.updated_at)) return false
      if (kind === 'contacts') return text(item.name) && [item.phone, item.email, item.note, item.folder_id].every(optionalText)
      if (kind === 'folders') return text(item.name) && optionalText(item.color)
      if (kind === 'debts') return text(item.contact_id) && positiveAmount(item.amount) && text(item.currency) && ['they_owe_me', 'i_owe_them'].includes(String(item.direction)) && ['pending', 'partial', 'paid'].includes(String(item.status)) && [item.description, item.due_date].every(optionalText)
      if (kind === 'payments') return positiveAmount(item.amount) && text(item.paid_at) && Number.isFinite(Date.parse(item.paid_at)) && optionalText(item.note) && (item.debt_id == null || item.debt_id === parts[1])
      return false
    }
    valid = method === 'GET' ? Array.isArray(value) && value.every(validItem) && new Set(value.map(item => item.id)).size === value.length : validItem(value)
    if (valid && method === 'PATCH' && parts[1]) valid = record(value) && value.id === parts[1]
  }
  if (!valid) throw new Error(method === 'GET' ? 'Сервер вернул неожиданный формат данных.' : 'Сервер вернул неожиданный ответ. Изменение могло сохраниться; обновите данные перед повторной отправкой.')
}

const request = async <T,>(method: string, path: string, body?: unknown, signal?: AbortSignal, forceLive = false): ApiResult<T> => {
  signal?.throwIfAborted()
  const demoMode = isDemoMode()
  if (demoMode && !forceLive) {
    const data = await demoRequest<T>(method, path, body)
    signal?.throwIfAborted()
    if (isDemoMode() !== demoMode) throw new Error('Режим данных изменился. Обновите страницу.')
    return { data, status: method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200 }
  }

  const response = await liveApi.request<T>({
    method,
    url: path,
    data: body,
    signal
  }).catch(error => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('adl-session-expired'))
    throw error
  })

  if (isDemoMode() !== demoMode) throw new Error('Режим данных изменился. Обновите страницу.')
  let data: unknown = response.data
  if (method === 'POST' && /^\/debts\/[^/]+\/payments$/.test(path) && record(data) && record(data.payment) && record(data.debt)) {
    validateResponse('PATCH', path.replace('/payments', ''), data.debt, response.status)
    data = data.payment
  }
  validateResponse(method, path, data, response.status)
  return { data: data as T, status: response.status }
}

const api = {
  get: <T,>(path: string, signal?: AbortSignal) => request<T>('GET', path, undefined, signal),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = null,>(path: string, options?: { data?: unknown }) => request<T>('DELETE', path, options?.data ?? {}),
  session: (signal?: AbortSignal) => request<{ user: CurrentUser }>('GET', '/auth/session', undefined, signal, true),
  login: async (email: string, password: string) => {
    await request<{ user: CurrentUser }>('POST', '/auth/login', { email, password }, undefined, true)
    disableDemoMode()
  },
  register: async (name: string, email: string, password: string) => {
    await request<{ user: CurrentUser }>('POST', '/auth/register', { name, email, password }, undefined, true)
    disableDemoMode()
  },
  updateProfile: (name: string) => request<CurrentUser>('PATCH', '/users/me', { name }, undefined, true),
  logout: async () => {
    await request<{ message: string }>('POST', '/auth/logout', {}, undefined, true)
    disableDemoMode()
  }
}

export const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined
    if (!error.response && error.config?.method && error.config.method.toUpperCase() !== 'GET') return 'Ответ сервера не получен. Изменение могло сохраниться; обновите данные перед повторной отправкой.'
    if (error.response?.status === 401) return 'Сессия завершилась. Войдите снова.'
    if (error.response?.status === 404) return 'Запись или запрошенный ресурс не найден. Обновите данные.'
    if (error.response?.status === 409) return 'Конфликт данных. Обновите данные и проверьте изменения.'
    if (error.response?.status === 422) return 'Сервер отклонил данные. Проверьте заполненные поля.'
    if (error.response?.status === 503) return 'Сервис временно недоступен. Попробуйте позже.'
    return (typeof data?.error === 'string' && data.error) || (typeof data?.message === 'string' && data.message) || error.message || 'Не удалось выполнить запрос.'
  }
  if (error instanceof Error) return error.message
  return 'Не удалось выполнить запрос.'
}

export const ensureArray = <T,>(value: unknown, _label: string): T[] => {
  if (Array.isArray(value) && value.every(item => item !== null && typeof item === 'object' && !Array.isArray(item))) return value as T[]
  throw new Error('Сервер вернул неожиданный формат данных.')
}

export default api
