import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useRef, useState } from 'react'
import SummaryCards from '../components/SummaryCards'
import ContentSkeleton from '../components/ContentSkeleton'
import api, { ensureArray, getErrorMessage } from '../api'
import { formatMoney, loadPayments, monthlyDebtOverview, recentPayments, totalsForCurrency } from '../finance'
import type { Contact, Debt, PaymentsMap } from '../types'
import { locale } from '../i18n'
import { useOutletContext } from 'react-router-dom'
import type { CurrentUser } from '../types'

const currentYear = new Date().getUTCFullYear()

const Dashboard = () => {
  const { t } = useTranslation()
  const user = useOutletContext<CurrentUser | null>()
  const monthLabels = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month, 1))))
  const [debts, setDebts] = useState<Debt[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [payments, setPayments] = useState<PaymentsMap>({})
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const currency = 'TJS'

  const requestController = useRef<AbortController | null>(null)

  const loadData = async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    const { signal } = controller
    setLoading(true)
    setError('')
    try {
      const [debtsResponse, contactsResponse] = await Promise.all([
        api.get<Debt[]>('/debts', signal),
        api.get<Contact[]>('/contacts', signal)
      ])
      const nextDebts = ensureArray<Debt>(debtsResponse.data, t("Долги"))
      const nextContacts = ensureArray<Contact>(contactsResponse.data, t("Контакты"))
      const nextPayments = await loadPayments(nextDebts, signal)
      if (signal.aborted) return
      setDebts(nextDebts)
      setContacts(nextContacts)
      setPayments(nextPayments)
    } catch (err) {
      if (!signal.aborted) setError(getErrorMessage(err))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    return () => requestController.current?.abort()
  }, [])

  useEffect(() => {
    const refresh = () => { loadData() }
    window.addEventListener('adl-data-changed', refresh)
    return () => window.removeEventListener('adl-data-changed', refresh)
  }, [])

  const totals = useMemo(() => totalsForCurrency(debts, payments, currency), [debts, payments])
  const recent = useMemo(() => recentPayments(debts, payments, contacts), [debts, payments, contacts])
  const months = useMemo(() => monthlyDebtOverview(debts, year, currency), [debts, year])
  const years = useMemo(() => [...new Set([
    currentYear - 1, currentYear, currentYear + 1,
    ...debts.filter(debt => debt.currency === currency).map(debt => new Date(debt.created_at || '').getUTCFullYear()).filter(Number.isFinite)
  ])].sort((a, b) => b - a), [debts])
  const maximum = Math.max(1, ...months.flatMap(month => [month.theyOwe, month.iOwe]))
  const x = (index: number) => 72 + index * 60
  const y = (value: number) => 270 - value / maximum * 220
  const theyOwePoints = months.map((month, index) => `${x(index)},${y(month.theyOwe)}`).join(' ')
  const iOwePoints = months.map((month, index) => `${x(index)},${y(month.iOwe)}`).join(' ')
  const hasChartData = months.some(month => month.theyOwe || month.iOwe)

  return (
    <div className="page-stack" aria-busy={loading && !error}>
      <section className="page-intro">
        <div><p className="eyebrow">{t("Панель управления")}</p><h2>{user?.name ? t('Добро пожаловать, {{name}}!', { name: user.name }) : t("Добро пожаловать!")}</h2></div>
      </section>

      {loading && !error && <ContentSkeleton variant="dashboard" />}
      {error && <div className="request-state error-state" role="alert"><strong>{t(error)}</strong><button className="secondary-button" onClick={loadData}>{t("Повторить")}</button></div>}

      {!loading && !error && <>
        <SummaryCards net={totals.net} theyOwe={totals.theyOwe} iOwe={totals.iOwe} currency={currency} />

        <div className="dashboard-grid">
          <section className="panel chart-panel">
            <div className="panel-heading">
              <div><h3>{t("Обзор долгов")}</h3><p>{t("По месяцам ·")} {currency}</p></div>
              <select aria-label={t("Год обзора долгов")} value={year} onChange={event => setYear(Number(event.target.value))}>
                {years.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <div className="debt-chart-legend"><span className="receivable-series">{t("Мне должны")}</span><span className="payable-series">{t("Я должен")}</span></div>
            <div className="debt-chart-wrap">
              <svg className="debt-chart" viewBox="0 0 770 315" role="img" aria-labelledby="debt-chart-title debt-chart-description">
                <title id="debt-chart-title">{t("Обзор долгов за {{v0}} год в {{v1}}", { v0: year, v1: currency })}</title>
                <desc id="debt-chart-description">{months.map((month, index) => t("{{v0}}: мне должны {{v1}}, я должен {{v2}}", { v0: monthLabels[index], v1: formatMoney(month.theyOwe, currency), v2: formatMoney(month.iOwe, currency) })).join('; ')}</desc>
                {Array.from({ length: 5 }, (_, index) => {
                  const value = maximum * index / 4
                  return <g key={index}><line className="chart-grid-line" x1="72" x2="732" y1={y(value)} y2={y(value)} /><text className="chart-axis-label" x="62" y={y(value) + 4} textAnchor="end">{new Intl.NumberFormat(locale(), { notation: 'compact', maximumFractionDigits: 1 }).format(value)}</text></g>
                })}
                <polygon className="chart-area receivable-series" points={`72,270 ${theyOwePoints} 732,270`} />
                <polygon className="chart-area payable-series" points={`72,270 ${iOwePoints} 732,270`} />
                <polyline className="chart-series receivable-series" points={theyOwePoints} />
                <polyline className="chart-series payable-series" points={iOwePoints} />
                {months.map((month, index) => <g key={index}>
                  <text className="chart-axis-label" x={x(index)} y="299" textAnchor="middle">{monthLabels[index]}</text>
                  <circle className="chart-point receivable-series" cx={x(index)} cy={y(month.theyOwe)} r="4"><title>{t("{{v0}} · Мне должны: {{v1}}", { v0: monthLabels[index], v1: formatMoney(month.theyOwe, currency) })}</title></circle>
                  <circle className="chart-point payable-series" cx={x(index)} cy={y(month.iOwe)} r="4"><title>{t("{{v0}} · Я должен: {{v1}}", { v0: monthLabels[index], v1: formatMoney(month.iOwe, currency) })}</title></circle>
                </g>)}
              </svg>
            </div>
            {!hasChartData && <p className="chart-empty-message" role="status">{t('За {{year}} год нет долгов в {{currency}}.', { year, currency })}</p>}
          </section>

          <section className="panel recent-panel">
            <div className="panel-heading"><div><h3>{t("Последние платежи")}</h3><p>{t("Недавние операции")}</p></div></div>
            {recent.length ? <ul className="recent-payment-list">
              {recent.map(({ payment, debt, contact }) => {
                const incoming = debt.direction === 'they_owe_me'
                return <li key={payment.id} className="recent-payment">
                  <span className={`payment-direction ${incoming ? 'text-positive' : 'text-negative'}`} aria-hidden="true">{incoming ? '↙' : '↗'}</span>
                  <div className="recent-payment-details"><strong>{contact?.name || t("Контакт недоступен")}</strong><span>{incoming ? t("Получено") : t("Выплачено")}</span><time dateTime={payment.paid_at}>{new Date(payment.paid_at).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })}</time></div>
                  <strong className={`recent-payment-amount ${incoming ? 'text-positive' : 'text-negative'}`}>{incoming ? '+' : '−'}{formatMoney(Number(payment.amount), debt.currency)}</strong>
                </li>
              })}
            </ul> : <div className="empty-state compact"><strong>{t("Платежей пока нет")}</strong><span>{t("Здесь появятся совершённые операции")}</span></div>}
          </section>
        </div>
      </>}
    </div>
  )
}

export default Dashboard
