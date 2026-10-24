import { locale } from '../i18n'
import { useTranslation } from 'react-i18next'
import ContentSkeleton from '../components/ContentSkeleton'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import api, { ensureArray, getErrorMessage } from '../api'
import { loadPayments, totalsForCurrency } from '../finance'
import type { Contact, ContactInput, Debt, Folder, PaymentsMap } from '../types'

type ContactForm = {
  name: string
  phone: string
  email: string
  note: string
  folder_id: string
}

const emptyForm: ContactForm = {
  name: '',
  phone: '',
  email: '',
  note: '',
  folder_id: ''
}

const Contacts = () => {
  const { t } = useTranslation()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<PaymentsMap>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const requestController = useRef<AbortController | null>(null)

  const loadContacts = async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    const { signal } = controller
    setLoading(true)
    setError('')

    try {
      const [contactsResponse, foldersResponse, debtsResponse] = await Promise.all([
        api.get<Contact[]>('/contacts', signal),
        api.get<Folder[]>('/folders', signal),
        api.get<Debt[]>('/debts', signal)
      ])
      const nextDebts = ensureArray<Debt>(debtsResponse.data, t("Долги"))
      const nextPayments = await loadPayments(nextDebts, signal)
      if (signal.aborted) return
      setContacts(ensureArray<Contact>(contactsResponse.data, t("Контакты")))
      setFolders(ensureArray<Folder>(foldersResponse.data, t("Папки")))
      setDebts(nextDebts)
      setPayments(nextPayments)
    } catch (err) {
      if (!signal.aborted) setError(getErrorMessage(err))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
    return () => requestController.current?.abort()
  }, [])

  useEffect(() => {
    const refresh = () => { loadContacts() }
    window.addEventListener('adl-data-changed', refresh)
    return () => window.removeEventListener('adl-data-changed', refresh)
  }, [])

  const filteredContacts = useMemo(() => {
    const value = search.trim().toLowerCase()
    if (!value) return contacts

    return contacts.filter(contact =>
      [contact.name, contact.phone, contact.email, contact.note]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(value)
    )
  }, [contacts, search])

  const netForContact = (contactId: string) => totalsForCurrency(debts.filter(debt => debt.contact_id === contactId), payments).net

  const openCreate = () => {
    setSelected(null)
    setForm(emptyForm)
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setSelected(contact)
    setForm({
      name: contact.name,
      phone: contact.phone || '',
      email: contact.email || '',
      note: contact.note || '',
      folder_id: contact.folder_id || ''
    })
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setSelected(null)
    setForm(emptyForm)
    setFormError('')
  }

  const buildPayload = () => {
    const payload: ContactInput = { name: form.name.trim() }
    const phone = form.phone.trim()
    const email = form.email.trim()
    const note = form.note.trim()

    if (selected) {
      payload.phone = phone
      payload.note = note
      if (email || selected.email) payload.email = email
      if (form.folder_id) payload.folder_id = form.folder_id
    } else {
      if (phone) payload.phone = phone
      if (email) payload.email = email
      if (note) payload.note = note
      if (form.folder_id) payload.folder_id = form.folder_id
    }

    return payload
  }

  const saveContact = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) {
      setFormError('Введите имя контакта.')
      return
    }

    setSaving(true)
    setFormError('')

    try {
      const payload = buildPayload()
      if (selected) {
        const response = await api.patch<Contact>(`/contacts/${selected.id}`, payload)
        if (requestController.current?.signal.aborted) return
        setContacts(current => current.map(contact => contact.id === selected.id ? response.data : contact))
      } else {
        const response = await api.post<Contact>('/contacts', payload)
        if (requestController.current?.signal.aborted) return
        setContacts(current => [response.data, ...current])
      }
      setModalOpen(false)
      setSelected(null)
      setForm(emptyForm)
    } catch (err) {
      if (!requestController.current?.signal.aborted) setFormError(getErrorMessage(err))
    } finally {
      if (!requestController.current?.signal.aborted) setSaving(false)
    }
  }

  const deleteContact = async (contact: Contact) => {
    const confirmed = window.confirm(t("Удалить контакт «{{v0}}»?", { v0: contact.name }))
    if (!confirmed) return

    try {
      await api.delete(`/contacts/${contact.id}`, { data: {} })
      if (requestController.current?.signal.aborted) return
      setContacts(current => current.filter(item => item.id !== contact.id))
      setDebts(current => current.filter(debt => debt.contact_id !== contact.id))
    } catch (err) {
      if (!requestController.current?.signal.aborted) setError(getErrorMessage(err))
    }
  }

  return (
    <div className="page-stack" aria-busy={loading && !error}>
      <section className="panel">
        <div className="table-toolbar">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Поиск контактов")} />
          <div className="toolbar-spacer" />
          <button className="primary-button" onClick={openCreate}>{t("Добавить контакт")}</button>
        </div>

        {error && <div className="request-state error-state"><strong>{t(error)}</strong><button className="secondary-button" onClick={loadContacts}>{t("Повторить")}</button></div>}
        {loading && !error && <ContentSkeleton variant="table" />}

        {!loading && !error && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("Полное имя")}</th><th>{t("Телефон")}</th><th>{t("Чистый итог")}</th><th>{t("Заметки")}</th><th>{t("Действия")}</th></tr></thead>
              <tbody>
                {filteredContacts.map(contact => {
                  const net = netForContact(contact.id)
                  return (
                    <tr key={contact.id}>
                      <td><div className="contact-name-cell"><strong>{contact.name}</strong>{contact.email && <span>{contact.email}</span>}</div></td>
                      <td>{contact.phone || '—'}</td>
                      <td><strong className={net > 0 ? 'text-positive' : net < 0 ? 'text-negative' : ''}>{net.toLocaleString(locale())} TJS</strong></td>
                      <td>{contact.note || '—'}</td>
                      <td><div className="row-actions"><button className="icon-button" onClick={() => openEdit(contact)} aria-label={t("Редактировать {{v0}}", { v0: contact.name })}><EditOutlinedIcon /></button><button className="icon-button danger-icon" onClick={() => deleteContact(contact)} aria-label={t("Удалить {{v0}}", { v0: contact.name })}><DeleteOutlineOutlinedIcon /></button></div></td>
                    </tr>
                  )
                })}
                {!filteredContacts.length && <tr><td colSpan={5}><div className="empty-state"><strong>{contacts.length ? t("Ничего не найдено") : t("Контактов пока нет")}</strong><span>{contacts.length ? t("Попробуйте изменить запрос.") : t("Добавьте первый контакт.")}</span></div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeModal()}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <div className="modal-heading"><h3>{selected ? t("Редактировать контакт") : t("Добавить контакт")}</h3><button className="icon-button" onClick={closeModal} disabled={saving}><CloseRoundedIcon /></button></div>
            <form className="contact-form" onSubmit={saveContact}>
              <label>{t("Имя")}<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} maxLength={120} required /></label>
              <div className="form-grid-two"><label>{t("Телефон")}<input value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} maxLength={40} /></label><label>{t("Email")}<input type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required={Boolean(selected?.email)} /></label></div>
              <label>{t("Папка")}<select value={form.folder_id} onChange={event => setForm(current => ({ ...current, folder_id: event.target.value }))}><option value="" disabled={Boolean(selected?.folder_id)}>{t("Без папки")}</option>{folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
              <label>{t("Заметка")}<textarea value={form.note} onChange={event => setForm(current => ({ ...current, note: event.target.value }))} maxLength={1000} rows={4} /></label>
              {formError && <div className="form-error">{t(formError)}</div>}
              <div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>{t("Отмена")}</button><button className="primary-button" type="submit" disabled={saving}>{saving ? t("Сохранение…") : t("Сохранить")}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Contacts
