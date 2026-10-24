import { locale } from './i18n'
import api, { ensureArray } from './api'
import type { Contact, Debt, Payment, PaymentsMap } from './types'

export const paymentTotal = (payments: PaymentsMap, debtId: string) => (payments[debtId] || []).reduce((sum, payment) => sum + Number(payment.amount), 0)

export const remaining = (debt: Debt, payments: PaymentsMap) => Number(debt.amount) - paymentTotal(payments, debt.id)

export const financialBalance = (debt: Debt, payments: PaymentsMap) => {
  const balance = (debt.direction === 'they_owe_me' ? 1 : -1) * remaining(debt, payments)
  return balance === 0 ? 0 : balance
}

export const paymentProgress = (debt: Debt, payments: PaymentsMap) => {
  const amount = Number(debt.amount)
  if (!amount) return 0
  return Math.round(paymentTotal(payments, debt.id) / amount * 100)
}

export const formatMoney = (value: number, currency = 'TJS') => `${new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value)} ${currency}`

export const loadPayments = async (debts: Debt[], signal?: AbortSignal) => {
  const entries = await Promise.all(debts.map(async debt => {
    const response = await api.get<Payment[]>(`/debts/${debt.id}/payments`, signal)
    return [debt.id, ensureArray<Payment>(response.data, 'Платежи')] as const
  }))
  return Object.fromEntries(entries) as PaymentsMap
}

export const totalsForCurrency = (debts: Debt[], payments: PaymentsMap, currency = 'TJS') => {
  const selected = debts.filter(debt => debt.currency === currency)
  const balances = selected.map(debt => financialBalance(debt, payments))
  const theyOwe = balances.filter(value => value > 0).reduce((sum, value) => sum + value, 0)
  const iOwe = balances.filter(value => value < 0).reduce((sum, value) => sum - value, 0)
  return { theyOwe, iOwe, net: theyOwe - iOwe }
}

export const monthlyDebtOverview = (debts: Debt[], year: number, currency = 'TJS') => {
  const months = Array.from({ length: 12 }, () => ({ theyOwe: 0, iOwe: 0 }))
  debts.forEach(debt => {
    const date = new Date(debt.created_at || '')
    if (debt.currency !== currency || date.getUTCFullYear() !== year) return
    const month = months[date.getUTCMonth()]
    if (debt.direction === 'they_owe_me') month.theyOwe += Number(debt.amount)
    if (debt.direction === 'i_owe_them') month.iOwe += Number(debt.amount)
  })
  return months
}

export const recentPayments = (debts: Debt[], payments: PaymentsMap, contacts: Contact[], limit = 5) => {
  const contactMap = new Map(contacts.map(contact => [contact.id, contact]))
  return debts.flatMap(debt => (payments[debt.id] || []).map(payment => ({
    payment,
    debt,
    contact: contactMap.get(debt.contact_id)
  })))
    .filter(item => Number.isFinite(Date.parse(item.payment.paid_at)))
    .sort((a, b) => Date.parse(b.payment.paid_at) - Date.parse(a.payment.paid_at) || a.payment.id.localeCompare(b.payment.id))
    .slice(0, limit)
}
