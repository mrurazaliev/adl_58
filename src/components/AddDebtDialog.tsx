import { createContext, useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import api, { getErrorMessage } from '../api'
import type { Contact, Debt, DebtDirection, DebtInput, Folder } from '../types'

export const DebtCreationContext = createContext<(direction?: DebtDirection) => void>(() => {})
type ContactOption = Contact & { createName?: string }
const filterOptions = createFilterOptions<ContactOption>({ stringify: option => option.name })

type Props = { direction: DebtDirection; onClose: () => void; onCreated: (debt: Debt) => void }

const AddDebtDialog = ({ direction, onClose, onCreated }: Props) => {
  const { t } = useTranslation()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [contact, setContact] = useState<ContactOption | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [folders, setFolders] = useState<Folder[]>([])
  const [form, setForm] = useState({ direction, amount: '', currency: 'TJS', due_date: '', description: '', folder_id: '' })
  const mounted = useRef(true)
  const busy = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const name = input.trim()
  const matchingContact = contacts.find(item => item.name.trim().toLowerCase() === name.toLowerCase())
  const loadContacts = async (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    try {
      const [response, folderResponse] = await Promise.all([api.get<Contact[]>('/contacts', signal), api.get<Folder[]>('/folders', signal)])
      if (mounted.current && !signal?.aborted) { setContacts(response.data); setFolders(folderResponse.data) }
    } catch (err) { if (mounted.current && !signal?.aborted) setError(getErrorMessage(err)) } finally { if (mounted.current && !signal?.aborted) setLoading(false) }
  }
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    loadContacts(controller.signal)
    return () => { mounted.current = false; controller.abort() }
  }, [])

  const selectContact = (option: ContactOption | null) => {
    if (busy.current) return
    setContact(option)
    setInput(option?.name || '')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current) return
    const name = input.trim()
    const amount = Number(form.amount)
    const invalid = (field: string, message: string) => {
      setError(message)
      formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus()
    }
    if (!name) { invalid('contact', 'Введите имя контакта.'); return }
    if (name.length > 120) { invalid('contact', 'Имя контакта должно содержать не более 120 символов.'); return }
    if (!Number.isFinite(amount) || amount <= 0) { invalid('amount', 'Введите сумму больше нуля.'); return }
    if (amount > 1000000000) { invalid('amount', 'Сумма не должна превышать 1 000 000 000.'); return }
    if (!['they_owe_me', 'i_owe_them'].includes(form.direction)) { invalid('direction', 'Выберите направление долга.'); return }
    busy.current = true
    setSaving(true)
    setError('')
    try {
      let selectedContact = contact && !contact.createName && contact.name.trim().toLowerCase() === name.toLowerCase() ? contact : matchingContact
      if (!selectedContact) {
        const latest = (await api.get<Contact[]>('/contacts')).data
        selectedContact = latest.find(item => item.name.trim().toLowerCase() === name.toLowerCase()) || (await api.post<Contact>('/contacts', { name, ...(form.folder_id ? { folder_id: form.folder_id } : {}) })).data
        if (!mounted.current) return
        const resolvedContact = selectedContact
        setContacts(current => current.some(item => item.id === resolvedContact.id) ? current : [resolvedContact, ...current])
        window.dispatchEvent(new Event('adl-data-changed'))
      }
      setContact(selectedContact)
      setInput(selectedContact.name)
      const payload: DebtInput = { contact_id: selectedContact.id, direction: form.direction, amount, currency: form.currency.trim().toUpperCase() || undefined, due_date: form.due_date || undefined, description: form.description.trim() || undefined }
      const response = await api.post<Debt>('/debts', payload)
      window.dispatchEvent(new Event('adl-data-changed'))
      if (mounted.current) onCreated(response.data)
    } catch (err) { if (mounted.current) setError(getErrorMessage(err)) } finally { busy.current = false; if (mounted.current) setSaving(false) }
  }
  const disabled = saving

  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !disabled && onClose()} onKeyDown={event => event.key === 'Escape' && !disabled && onClose()}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="add-debt-title">
      <div className="modal-heading"><h3 id="add-debt-title">{t('Добавить долг')}</h3><button className="icon-button" aria-label={t('Закрыть')} disabled={disabled} onClick={onClose}>×</button></div>
      <form className="contact-form" ref={formRef} onSubmit={save} noValidate>
        <Autocomplete<ContactOption, false, false, true> freeSolo options={contacts} value={contact} inputValue={input} loading={loading} disabled={disabled}
          getOptionLabel={option => typeof option === 'string' ? option : option.createName ? t('Создать «{{name}}»', { name: option.createName }) : option.name}
          getOptionKey={option => typeof option === 'string' ? option : option.id}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          filterOptions={(options, state) => {
            const filtered = filterOptions(options, { ...state, inputValue: state.inputValue.trim() })
            const name = state.inputValue.trim()
            if (name && !options.some(item => item.name.trim().toLowerCase() === name.toLowerCase())) filtered.push({ id: 'create-contact-option', name, createName: name })
            return filtered
          }}
          onInputChange={(_, value, reason) => { if (reason === 'input' || reason === 'clear') { setInput(value); setContact(null) } }}
          onChange={(_, option) => { if (typeof option === 'string') { setInput(option); setContact(null) } else selectContact(option) }}
          loadingText={t('Загрузка контактов…')} noOptionsText={t('Ничего не найдено')} clearText={t('Очистить')} openText={t('Открыть')} closeText={t('Закрыть')}
          renderInput={params => <TextField {...params} label={t('Контакт')} autoFocus slotProps={{ htmlInput: { ...params.inputProps, name: 'contact', maxLength: 120 } }} />}
          sx={{ '& .MuiInputBase-root': { color: 'var(--text)', backgroundColor: 'var(--field)' }, '& .MuiInputLabel-root': { color: 'var(--muted)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--border)' } }}
          slotProps={{ paper: { sx: { backgroundColor: 'var(--surface)', color: 'var(--text)' } } }} />
        {name && !matchingContact && <label>{t('Папка')}<select value={form.folder_id} disabled={disabled} onChange={event => setForm(current => ({ ...current, folder_id: event.target.value }))}><option value="">{t('Без папки')}</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>}
        <div className="form-grid-two"><label>{t('Направление')}<select name="direction" value={form.direction} onChange={event => setForm(current => ({ ...current, direction: event.target.value as DebtDirection }))} disabled={disabled}><option value="they_owe_me">{t('Мне должны')}</option><option value="i_owe_them">{t('Я должен')}</option></select></label><label>{t('Сумма')}<input name="amount" type="number" min="0.01" step="0.01" required value={form.amount} disabled={disabled} onChange={event => setForm(current => ({ ...current, amount: event.target.value }))} /></label></div>
        <div className="form-grid-two"><label>{t('Валюта')}<input value={form.currency} maxLength={8} required disabled={disabled} onChange={event => setForm(current => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label><label>{t('Дата погашения')}<input type="date" value={form.due_date} disabled={disabled} onChange={event => setForm(current => ({ ...current, due_date: event.target.value }))} /></label></div>
        <label>{t('Описание')}<textarea rows={4} maxLength={1000} value={form.description} disabled={disabled} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
        {error && <div className="form-error" role="alert">{t(error)}<button type="button" className="secondary-button" disabled={disabled} onClick={() => loadContacts()}>{t('Обновить контакты')}</button></div>}
        <div className="modal-actions"><button className="secondary-button" type="button" onClick={onClose} disabled={disabled}>{t('Отмена')}</button><button className="primary-button" type="submit" disabled={saving}>{disabled ? t('Сохранение…') : t('Сохранить')}</button></div>
      </form>
    </div>
  </div>
}

export default AddDebtDialog
