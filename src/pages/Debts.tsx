import { DebtCreationContext } from '../components/AddDebtDialog'
import { locale } from '../i18n'
import { useTranslation } from 'react-i18next'
import { useContext, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import SummaryCards from '../components/SummaryCards'
import ContentSkeleton from '../components/ContentSkeleton'
import api, { ensureArray, getErrorMessage } from '../api'
import { financialBalance, loadPayments, paymentProgress, paymentTotal, remaining, totalsForCurrency } from '../finance'
import type { Contact, Debt, DebtDirection, DebtInput, Folder, Payment, PaymentInput, PaymentsMap } from '../types'

type DebtForm = {
  contact_id: string
  direction: DebtDirection
  amount: string
  currency: string
  description: string
  due_date: string
}

type PaymentForm = {
  debt_id: string
  amount: string
  note: string
}

const emptyDebt: DebtForm = {
  contact_id: '',
  direction: 'they_owe_me',
  amount: '',
  currency: 'TJS',
  description: '',
  due_date: ''
}

const Debts = () => {
  const { t } = useTranslation()
  const openAddDebt = useContext(DebtCreationContext)
  const [debts, setDebts] = useState<Debt[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [payments, setPayments] = useState<PaymentsMap>({})
  const [search, setSearch] = useState('')
  const [contactFilter, setContactFilter] = useState('all')
  const [folderFilter, setFolderFilter] = useState('all')
  const [sort, setSort] = useState('new')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [debtModal, setDebtModal] = useState(false)
  const [paymentModal, setPaymentModal] = useState(false)
  const [selected, setSelected] = useState<Debt | null>(null)
  const [debtForm, setDebtForm] = useState<DebtForm>(emptyDebt)
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ debt_id: '', amount: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
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
      const [debtsResponse, contactsResponse, foldersResponse] = await Promise.all([
        api.get<Debt[]>('/debts', signal),
        api.get<Contact[]>('/contacts', signal),
        api.get<Folder[]>('/folders', signal)
      ])
      const nextDebts = ensureArray<Debt>(debtsResponse.data, t("Долги"))
      const nextPayments = await loadPayments(nextDebts, signal)
      if (signal.aborted) return
      setDebts(nextDebts)
      setContacts(ensureArray<Contact>(contactsResponse.data, t("Контакты")))
      setFolders(ensureArray<Folder>(foldersResponse.data, t("Папки")))
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

  const contactMap = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts])
  const folderMap = useMemo(() => new Map(folders.map(folder => [folder.id, folder])), [folders])
  const totals = useMemo(() => totalsForCurrency(debts, payments, currency), [debts, payments])

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase()
    const list = debts.filter(debt => {
      const contact = contactMap.get(debt.contact_id)
      const matchesSearch = !value || [contact?.name, debt.description].filter(Boolean).join(' ').toLowerCase().includes(value)
      const matchesContact = contactFilter === 'all' || debt.contact_id === contactFilter
      const matchesFolder = folderFilter === 'all' || (folderFilter === 'none' ? !contact?.folder_id : contact?.folder_id === folderFilter)
      return matchesSearch && matchesContact && matchesFolder
    })

    return [...list].sort((a, b) => {
      if (sort === 'amount') return Math.abs(financialBalance(b, payments)) - Math.abs(financialBalance(a, payments))
      if (sort === 'due') return (a.due_date || '9999-12-31').localeCompare(b.due_date || '9999-12-31')
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
  }, [debts, search, contactFilter, folderFilter, sort, contactMap, payments])

  const openCreate = () => openAddDebt('they_owe_me')

  const openEdit = (debt: Debt) => {
    setSelected(debt)
    setDebtForm({
      contact_id: debt.contact_id,
      direction: debt.direction,
      amount: String(debt.amount),
      currency: debt.currency,
      description: debt.description || '',
      due_date: debt.due_date?.slice(0, 10) || ''
    })
    setFormError('')
    setDebtModal(true)
  }

  const openPayment = (debt?: Debt) => {
    const target = debt || debts.find(item => remaining(item, payments) > 0) || debts[0]
    setPaymentForm({ debt_id: target?.id || '', amount: '', note: '' })
    setFormError('')
    setPaymentModal(true)
  }

  const saveDebt = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected) return
    const amount = Number(debtForm.amount)
    if (!debtForm.contact_id || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Выберите контакт и укажите сумму больше нуля.')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const payload: DebtInput = {
        contact_id: debtForm.contact_id,
        direction: debtForm.direction,
        amount,
        currency: debtForm.currency,
        description: debtForm.description.trim() || undefined,
        due_date: debtForm.due_date || undefined
      }

      const response = await api.patch<Debt>(`/debts/${selected.id}`, payload)
      if (requestController.current?.signal.aborted) return
      setDebts(current => current.map(debt => debt.id === selected.id ? response.data : debt))
      setDebtModal(false)
      setSelected(null)
    } catch (err) {
      if (!requestController.current?.signal.aborted) setFormError(getErrorMessage(err))
    } finally {
      if (!requestController.current?.signal.aborted) setSaving(false)
    }
  }

  const savePayment = async (event: FormEvent) => {
    event.preventDefault()
    const debt = debts.find(item => item.id === paymentForm.debt_id)
    const amount = Number(paymentForm.amount)
    if (!debt || !Number.isFinite(amount) || amount <= 0) {
      setFormError('Выберите долг и укажите сумму больше нуля.')
      return
    }
    setSaving(true)
    setFormError('')

    try {
      const payload: PaymentInput = { amount, note: paymentForm.note.trim() || undefined }
      const response = await api.post<Payment>(`/debts/${debt.id}/payments`, payload)
      if (requestController.current?.signal.aborted) return
      setPayments(current => ({ ...current, [debt.id]: [...(current[debt.id] || []), response.data] }))
      const nextPaid = paymentTotal(payments, debt.id) + Number(response.data.amount)
      setDebts(current => current.map(item => item.id === debt.id ? { ...item, status: nextPaid >= Number(item.amount) ? 'paid' : 'partial' } : item))
      setPaymentModal(false)
      await loadData()
    } catch (err) {
      if (!requestController.current?.signal.aborted) setFormError(getErrorMessage(err))
    } finally {
      if (!requestController.current?.signal.aborted) setSaving(false)
    }
  }

  const deleteDebt = async (debt: Debt) => {
    if (!window.confirm(t("Удалить долг для «{{v0}}»?", { v0: contactMap.get(debt.contact_id)?.name || 'контакта' }))) return
    try {
      await api.delete(`/debts/${debt.id}`, { data: {} })
      if (requestController.current?.signal.aborted) return
      setDebts(current => current.filter(item => item.id !== debt.id))
      setPayments(current => {
        const next = { ...current }
        delete next[debt.id]
        return next
      })
    } catch (err) {
      if (!requestController.current?.signal.aborted) setError(getErrorMessage(err))
    }
  }

  const exportCsv = () => {
    const rows = [[t("Контакт"), t("Текущее направление"), t("Исходная сумма"), t("Валюта"), t("Платежи"), t("Текущий баланс"), t("Срок"), t("Описание")]]
    filtered.forEach(debt => rows.push([
      contactMap.get(debt.contact_id)?.name || '—',
      financialBalance(debt, payments) > 0 ? t("Мне должны") : financialBalance(debt, payments) < 0 ? t("Я должен") : t("Расчёт завершён"),
      String(debt.amount),
      debt.currency,
      String(paymentTotal(payments, debt.id)),
      String(Math.abs(financialBalance(debt, payments))),
      debt.due_date?.slice(0, 10) || '',
      debt.description || ''
    ]))
    const cell = (value: string) => `"${value.replaceAll('"', '""')}"`
    const blob = new Blob(['\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'adl58-debts.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-stack" aria-busy={loading && !error}>
      {loading && !error && <ContentSkeleton variant="summary" />}
      {!loading && !error && <SummaryCards net={totals.net} theyOwe={totals.theyOwe} iOwe={totals.iOwe} currency={currency} />}

      <section className="panel">
        <div className="table-toolbar">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Поиск")} />
          <select value={contactFilter} onChange={event => setContactFilter(event.target.value)}>
            <option value="all">{t("Все контакты")}</option>
            {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
          </select>
          <select value={folderFilter} onChange={event => setFolderFilter(event.target.value)}>
            <option value="all">{t("Все папки")}</option>
            <option value="none">{t("Без папки")}</option>
            {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
          <select value={sort} onChange={event => setSort(event.target.value)}>
            <option value="new">{t("Сначала новые")}</option>
            <option value="due">{t("По сроку")}</option>
            <option value="amount">{t("По сумме")}</option>
          </select>
          <div className="toolbar-spacer" />
          <button className="secondary-button" onClick={exportCsv}>{t("Экспорт")}</button>
          <button className="secondary-button" onClick={openCreate}>{t("Добавить долг")}</button>
          <button className="primary-button" onClick={() => openPayment()}>{t("Быстрый платёж")}</button>
        </div>

        {error && <div className="request-state error-state"><strong>{t(error)}</strong><button className="secondary-button" onClick={loadData}>{t("Повторить")}</button></div>}
        {loading && !error && <ContentSkeleton variant="table" />}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Полное имя")}</th><th>{t("Сумма")}</th><th>{t("Прогресс")}</th><th>{t("Дата погашения")}</th><th>{t("Действия")}</th></tr></thead>
              <tbody>
                {filtered.map(debt => {
                  const contact = contactMap.get(debt.contact_id)
                  const progress = paymentProgress(debt, payments)
                  const balance = financialBalance(debt, payments)
                  return (
                    <tr key={debt.id}>
                      <td><div className="contact-name-cell"><strong>{contact?.name || '—'}</strong><span>{balance > 0 ? t("Мне должны") : balance < 0 ? t("Я должен") : t("Расчёт завершён")}{contact?.folder_id ? ` · ${folderMap.get(contact.folder_id)?.name || ''}` : ''}</span></div></td>
                      <td><strong className={balance > 0 ? 'text-positive' : balance < 0 ? 'text-negative' : ''}>{Math.abs(balance).toLocaleString(locale())} {debt.currency}</strong></td>
                      <td><div className="progress-cell"><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><span>{progress}%</span></div>{remaining(debt, payments) < 0 && <span className="muted-value">{t("Баланс изменил направление")}</span>}</td>
                      <td>{debt.due_date?.slice(0, 10) || '—'}</td>
                      <td><div className="row-actions"><button className="icon-button" onClick={() => openPayment(debt)} aria-label={t("Платёж")}><PaymentsOutlinedIcon /></button><button className="icon-button" onClick={() => openEdit(debt)} aria-label={t("Редактировать")}><EditOutlinedIcon /></button><button className="icon-button danger-icon" onClick={() => deleteDebt(debt)} aria-label={t("Удалить")}><DeleteOutlineOutlinedIcon /></button></div></td>
                    </tr>
                  )
                })}
                {!filtered.length && <tr><td colSpan={5}><div className="empty-state"><strong>{debts.length ? t("Ничего не найдено") : t("Долгов пока нет")}</strong><span>{debts.length ? t("Измените фильтры.") : t("Добавьте первый долг.")}</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {debtModal && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && setDebtModal(false)}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-heading"><h3>{t("Редактировать долг")}</h3><button className="icon-button" onClick={() => !saving && setDebtModal(false)}><CloseRoundedIcon /></button></div>
            <form className="contact-form" onSubmit={saveDebt}>
              <label>{t("Контакт")}<select value={debtForm.contact_id} onChange={event => setDebtForm(current => ({ ...current, contact_id: event.target.value }))} required><option value="">{t("Выберите контакт")}</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
              <div className="form-grid-two">
                <label>{t("Направление")}<select value={debtForm.direction} onChange={event => setDebtForm(current => ({ ...current, direction: event.target.value as DebtDirection }))}><option value="they_owe_me">{t("Мне должны")}</option><option value="i_owe_them">{t("Я должен")}</option></select></label>
                <label>{t("Сумма")}<input type="number" min="0.01" step="0.01" value={debtForm.amount} onChange={event => setDebtForm(current => ({ ...current, amount: event.target.value }))} required /></label>
              </div>
              <div className="form-grid-two">
                <label>{t("Валюта")}<input value={debtForm.currency} onChange={event => setDebtForm(current => ({ ...current, currency: event.target.value.toUpperCase() }))} maxLength={8} /></label>
                <label>{t("Дата погашения")}<input type="date" value={debtForm.due_date} onChange={event => setDebtForm(current => ({ ...current, due_date: event.target.value }))} /></label>
              </div>
              <label>{t("Описание")}<textarea rows={4} maxLength={1000} value={debtForm.description} onChange={event => setDebtForm(current => ({ ...current, description: event.target.value }))} /></label>
              {formError && <div className="form-error">{t(formError)}</div>}
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => !saving && setDebtModal(false)}>{t("Отмена")}</button><button className="primary-button" disabled={saving}>{saving ? t("Сохранение…") : t("Сохранить")}</button></div>
            </form>
          </div>
        </div>
      )}

      {paymentModal && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && setPaymentModal(false)}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-heading"><h3>{t("Быстрый платёж")}</h3><button className="icon-button" onClick={() => !saving && setPaymentModal(false)}><CloseRoundedIcon /></button></div>
            <form className="contact-form" onSubmit={savePayment}>
              <label>{t("Долг")}<select value={paymentForm.debt_id} onChange={event => setPaymentForm(current => ({ ...current, debt_id: event.target.value }))} required><option value="">{t("Выберите долг")}</option>{debts.map(debt => <option key={debt.id} value={debt.id}>{contactMap.get(debt.contact_id)?.name || '—'} · {debt.direction === 'they_owe_me' ? t("Получение") : t("Выплата")}  {t("· баланс")} {remaining(debt, payments).toLocaleString(locale())} {debt.currency}</option>)}</select></label>
              <p className="form-note">{t("Платёж сохраняет исходное направление операции. Превышение суммы меняет направление баланса.")}</p>
              <label>{t("Сумма")}<input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={event => setPaymentForm(current => ({ ...current, amount: event.target.value }))} required /></label>
              <label>{t("Заметка")}<textarea rows={3} maxLength={500} value={paymentForm.note} onChange={event => setPaymentForm(current => ({ ...current, note: event.target.value }))} /></label>
              {formError && <div className="form-error">{t(formError)}</div>}
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => !saving && setPaymentModal(false)}>{t("Отмена")}</button><button className="primary-button" disabled={saving}>{saving ? t("Сохранение…") : t("Сохранить платёж")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Debts
