import type { Contact, Debt, Folder, Payment, PaymentInput } from './types'

const STORAGE_KEY = 'adl-react-demo-v2'
const MODE_KEY = 'adl-react-data-mode'

export type DemoState = {
  contacts: Contact[]
  folders: Folder[]
  debts: Debt[]
  payments: Record<string, Payment[]>
}

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const day = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

const createState = (): DemoState => {
  const folders: Folder[] = [
    { id: uid(), name: 'Личные', color: '#c58a3a', created_at: now() },
    { id: uid(), name: 'Работа', color: '#6aa878', created_at: now() }
  ]

  const contacts: Contact[] = [
    { id: uid(), name: 'Фарид Саидов', phone: '+992 90 111 22 33', note: 'Личная договорённость', folder_id: folders[0].id, created_at: now() },
    { id: uid(), name: 'Мадина Каримова', phone: '+992 92 555 44 11', note: 'Рабочий проект', folder_id: folders[1].id, created_at: now() },
    { id: uid(), name: 'Алишер Назаров', phone: '+992 93 777 20 20', note: 'Совместные расходы', folder_id: null, created_at: now() }
  ]

  const debts: Debt[] = [
    { id: uid(), contact_id: contacts[0].id, direction: 'they_owe_me', amount: 2500, currency: 'TJS', description: 'Личная договорённость', due_date: day(8), status: 'pending', created_at: now() },
    { id: uid(), contact_id: contacts[1].id, direction: 'i_owe_them', amount: 1200, currency: 'TJS', description: 'Рабочие расходы', due_date: day(14), status: 'partial', created_at: now() },
    { id: uid(), contact_id: contacts[2].id, direction: 'they_owe_me', amount: 850, currency: 'TJS', description: 'Совместная покупка', due_date: day(-3), status: 'pending', created_at: now() }
  ]

  const firstPayment: Payment = {
    id: uid(),
    debt_id: debts[1].id,
    amount: 400,
    note: 'Первый платёж',
    paid_at: now(),
    created_at: now()
  }

  return {
    folders,
    contacts,
    debts,
    payments: {
      [debts[0].id]: [],
      [debts[1].id]: [firstPayment],
      [debts[2].id]: []
    }
  }
}

let demoEnabled = false

export const isDemoMode = () => demoEnabled && localStorage.getItem(MODE_KEY) === 'demo'

export const enableDemoMode = () => {
  demoEnabled = true
  localStorage.setItem(MODE_KEY, 'demo')
  if (!localStorage.getItem(STORAGE_KEY)) writeDemoState(createState())
}

export const disableDemoMode = () => {
  demoEnabled = false
  localStorage.setItem(MODE_KEY, 'live')
}

export const resetDemoState = () => writeDemoState(createState())

export const readDemoState = (): DemoState => {
  const value = localStorage.getItem(STORAGE_KEY)
  if (!value) {
    const state = createState()
    writeDemoState(state)
    return state
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('Demo-данные повреждены. Сохранённые данные не изменены.')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('Неверный формат demo-данных. Сохранённые данные не изменены.')
  const state = parsed as DemoState
  const record = (item: unknown): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item)
  const optionalText = (value: unknown) => value == null || typeof value === 'string'
  if (!Array.isArray(state.contacts) || !state.contacts.every(item => record(item) && typeof item.id === 'string' && typeof item.name === 'string' && [item.phone, item.email, item.note, item.folder_id].every(optionalText))
    || !Array.isArray(state.folders) || !state.folders.every(item => record(item) && typeof item.id === 'string' && typeof item.name === 'string' && optionalText(item.color))
    || !Array.isArray(state.debts) || !state.debts.every(item => record(item) && typeof item.id === 'string' && typeof item.contact_id === 'string' && typeof item.currency === 'string' && Number.isFinite(item.amount) && Number(item.amount) > 0 && ['they_owe_me', 'i_owe_them'].includes(String(item.direction)) && ['pending', 'partial', 'paid'].includes(String(item.status)) && [item.description, item.due_date, item.created_at].every(optionalText))
    || !record(state.payments) || !Object.values(state.payments).every(items => Array.isArray(items) && items.every(item => record(item) && typeof item.id === 'string' && typeof item.paid_at === 'string' && Number.isFinite(item.amount) && Number(item.amount) > 0))) {
    throw new Error('Неверный формат demo-данных. Сохранённые данные не изменены.')
  }
  return state
}

export const writeDemoState = (state: DemoState) => localStorage.setItem(STORAGE_KEY, JSON.stringify(state))

const paymentTotal = (state: DemoState, debtId: string) => (state.payments[debtId] || []).reduce((sum, payment) => sum + Number(payment.amount), 0)

export const demoRequest = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
  const state = readDemoState()
  const parts = path.split('?')[0].split('/').filter(Boolean)

  if (method === 'GET' && path === '/auth/session') {
    return { user: { id: 'demo', name: 'Abuumar', email: 'demo@example.com' } } as T
  }

  if (method === 'GET' && path === '/contacts') return structuredClone(state.contacts) as T
  if (method === 'GET' && path === '/folders') return structuredClone(state.folders) as T
  if (method === 'GET' && path === '/debts') return structuredClone(state.debts) as T

  if (method === 'GET' && parts[0] === 'debts' && parts[2] === 'payments') {
    return structuredClone(state.payments[parts[1]] || []) as T
  }

  if (method === 'POST' && path === '/contacts') {
    const contact = { ...(body as Contact), id: uid(), created_at: now() }
    state.contacts.unshift(contact)
    writeDemoState(state)
    return structuredClone(contact) as T
  }

  if (method === 'PATCH' && parts[0] === 'contacts') {
    const contact = state.contacts.find(item => item.id === parts[1])
    if (!contact) throw new Error('Контакт не найден.')
    Object.assign(contact, body)
    writeDemoState(state)
    return structuredClone(contact) as T
  }

  if (method === 'DELETE' && parts[0] === 'contacts') {
    const linked = state.debts.filter(debt => debt.contact_id === parts[1])
    linked.forEach(debt => delete state.payments[debt.id])
    state.debts = state.debts.filter(debt => debt.contact_id !== parts[1])
    state.contacts = state.contacts.filter(contact => contact.id !== parts[1])
    writeDemoState(state)
    return null as T
  }

  if (method === 'POST' && path === '/folders') {
    const folder = { ...(body as Folder), id: uid(), created_at: now() }
    state.folders.unshift(folder)
    writeDemoState(state)
    return structuredClone(folder) as T
  }

  if (method === 'PATCH' && parts[0] === 'folders') {
    const folder = state.folders.find(item => item.id === parts[1])
    if (!folder) throw new Error('Папка не найдена.')
    Object.assign(folder, body)
    writeDemoState(state)
    return structuredClone(folder) as T
  }

  if (method === 'DELETE' && parts[0] === 'folders') {
    state.folders = state.folders.filter(folder => folder.id !== parts[1])
    state.contacts.forEach(contact => {
      if (contact.folder_id === parts[1]) contact.folder_id = null
    })
    writeDemoState(state)
    return null as T
  }

  if (method === 'POST' && path === '/debts') {
    const debt: Debt = { ...(body as Debt), id: uid(), status: 'pending', created_at: now() }
    state.debts.unshift(debt)
    state.payments[debt.id] = []
    writeDemoState(state)
    return structuredClone(debt) as T
  }

  if (method === 'PATCH' && parts[0] === 'debts' && parts.length === 2) {
    const debt = state.debts.find(item => item.id === parts[1])
    if (!debt) throw new Error('Долг не найден.')
    Object.assign(debt, body)
    const paid = paymentTotal(state, debt.id)
    debt.status = paid >= Number(debt.amount) ? 'paid' : paid > 0 ? 'partial' : 'pending'
    writeDemoState(state)
    return structuredClone(debt) as T
  }

  if (method === 'DELETE' && parts[0] === 'debts' && parts.length === 2) {
    state.debts = state.debts.filter(debt => debt.id !== parts[1])
    delete state.payments[parts[1]]
    writeDemoState(state)
    return null as T
  }

  if (method === 'POST' && parts[0] === 'debts' && parts[2] === 'payments') {
    const debt = state.debts.find(item => item.id === parts[1])
    if (!debt) throw new Error('Долг не найден.')
    const input = body as PaymentInput
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('Введите сумму больше нуля.')
    const payment: Payment = { id: uid(), debt_id: debt.id, amount: input.amount, note: input.note || '', paid_at: now(), created_at: now() }
    state.payments[debt.id] ||= []
    state.payments[debt.id].push(payment)
    const paid = paymentTotal(state, debt.id)
    debt.status = paid >= Number(debt.amount) ? 'paid' : 'partial'
    writeDemoState(state)
    return structuredClone(payment) as T
  }

  throw new Error('Эта demo-операция пока не поддерживается.')
}
