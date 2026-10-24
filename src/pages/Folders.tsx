import { locale } from '../i18n'
import { useTranslation } from 'react-i18next'
import ContentSkeleton from '../components/ContentSkeleton'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import api, { ensureArray, getErrorMessage } from '../api'
import { loadPayments, totalsForCurrency } from '../finance'
import type { Contact, Debt, Folder, FolderInput, PaymentsMap } from '../types'

type FolderForm = { name: string; color: string }
const emptyForm: FolderForm = { name: '', color: '#f59e0b' }

const Folders = () => {
  const { t } = useTranslation()
  const [folders, setFolders] = useState<Folder[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [debts, setDebts] = useState<Debt[]>([])
  const [payments, setPayments] = useState<PaymentsMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [selected, setSelected] = useState<Folder | null>(null)
  const [form, setForm] = useState<FolderForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const requestController = useRef<AbortController | null>(null)

  const loadFolders = async () => {
    requestController.current?.abort()
    const controller = new AbortController()
    requestController.current = controller
    const { signal } = controller
    setLoading(true)
    setError('')
    try {
      const [foldersResponse, contactsResponse, debtsResponse] = await Promise.all([
        api.get<Folder[]>('/folders', signal),
        api.get<Contact[]>('/contacts', signal),
        api.get<Debt[]>('/debts', signal)
      ])
      const nextDebts = ensureArray<Debt>(debtsResponse.data, t("Долги"))
      const nextPayments = await loadPayments(nextDebts, signal)
      if (signal.aborted) return
      setFolders(ensureArray<Folder>(foldersResponse.data, t("Папки")))
      setContacts(ensureArray<Contact>(contactsResponse.data, t("Контакты")))
      setDebts(nextDebts)
      setPayments(nextPayments)
    } catch (err) {
      if (!signal.aborted) setError(getErrorMessage(err))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }

  useEffect(() => {
    loadFolders()
    return () => requestController.current?.abort()
  }, [])

  useEffect(() => {
    const refresh = () => { loadFolders() }
    window.addEventListener('adl-data-changed', refresh)
    return () => window.removeEventListener('adl-data-changed', refresh)
  }, [])

  const contactsById = useMemo(() => new Map(contacts.map(contact => [contact.id, contact])), [contacts])

  const valuesForFolder = (folderId: string | null) => {
    const folderDebts = debts.filter(debt => debt.currency === 'TJS' && (contactsById.get(debt.contact_id)?.folder_id || null) === folderId)
    return totalsForCurrency(folderDebts, payments)
  }

  const openCreate = () => { setSelected(null); setForm(emptyForm); setFormError(''); setModalOpen(true) }
  const openEdit = (folder: Folder) => { setSelected(folder); setForm({ name: folder.name, color: folder.color || '#f59e0b' }); setFormError(''); setModalOpen(true) }
  const closeModal = () => { if (saving) return; setModalOpen(false); setSelected(null); setForm(emptyForm); setFormError('') }

  const saveFolder = async (event: FormEvent) => {
    event.preventDefault()
    const name = form.name.trim()
    if (!name) { setFormError('Введите название папки.'); return }
    setSaving(true); setFormError('')
    try {
      const payload: FolderInput = { name, color: form.color }
      if (selected) {
        const response = await api.patch<Folder>(`/folders/${selected.id}`, payload)
        if (requestController.current?.signal.aborted) return
        setFolders(current => current.map(folder => folder.id === selected.id ? response.data : folder))
      } else {
        const response = await api.post<Folder>('/folders', payload)
        if (requestController.current?.signal.aborted) return
        setFolders(current => [response.data, ...current])
      }
      setModalOpen(false); setSelected(null); setForm(emptyForm)
    } catch (err) { if (!requestController.current?.signal.aborted) setFormError(getErrorMessage(err)) } finally { if (!requestController.current?.signal.aborted) setSaving(false) }
  }

  const deleteFolder = async (folder: Folder) => {
    if (!window.confirm(t("Удалить папку «{{v0}}»?", { v0: folder.name }))) return
    try {
      await api.delete(`/folders/${folder.id}`, { data: {} })
      if (requestController.current?.signal.aborted) return
      setFolders(current => current.filter(item => item.id !== folder.id))
      setContacts(current => current.map(contact => contact.folder_id === folder.id ? { ...contact, folder_id: null } : contact))
    } catch (err) { if (!requestController.current?.signal.aborted) setError(getErrorMessage(err)) }
  }

  const renderValues = (folderId: string | null) => {
    const values = valuesForFolder(folderId)
    return <div className="folder-values"><div><span>{t("Чистый итог")}</span><strong className={values.net > 0 ? 'text-positive' : values.net < 0 ? 'text-negative' : ''}>{values.net.toLocaleString(locale())} TJS</strong></div><div><span>{t("Мне должны")}</span><strong className="text-positive">{values.theyOwe.toLocaleString(locale())} TJS</strong></div><div><span>{t("Я должен")}</span><strong className="text-negative">{values.iOwe.toLocaleString(locale())} TJS</strong></div></div>
  }

  return (
    <div className="page-stack" aria-busy={loading && !error}>
      <div className="page-actions"><button className="primary-button" onClick={openCreate}>{t("Добавить папку")}</button></div>
      {error && <div className="request-state error-state"><strong>{t(error)}</strong><button className="secondary-button" onClick={loadFolders}>{t("Повторить")}</button></div>}
      {loading && !error && <ContentSkeleton variant="folders" />}
      {!loading && !error && (
        <div className="folder-grid">
          <section className="folder-card no-folder-card"><div className="folder-title"><div><span className="folder-color-dot neutral-dot" /><h3>{t("Без папки")}</h3></div></div>{renderValues(null)}</section>
          {folders.map(folder => <section className="folder-card" key={folder.id}><div className="folder-title"><div><span className="folder-color-dot" style={{ background: folder.color || '#f59e0b' }} /><h3>{folder.name}</h3></div><div className="row-actions"><button className="icon-button" onClick={() => openEdit(folder)} aria-label={t("Редактировать {{v0}}", { v0: folder.name })}><EditOutlinedIcon /></button><button className="icon-button danger-icon" onClick={() => deleteFolder(folder)} aria-label={t("Удалить {{v0}}", { v0: folder.name })}><DeleteOutlineOutlinedIcon /></button></div></div>{renderValues(folder.id)}</section>)}
          {!folders.length && <section className="folder-card folder-empty-card"><strong>{t("Папок пока нет")}</strong><span>{t("Создай первую папку, чтобы группировать контакты.")}</span></section>}
        </div>
      )}
      {modalOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeModal()}><div className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><h3>{selected ? t("Редактировать папку") : t("Добавить папку")}</h3><button className="icon-button" onClick={closeModal} disabled={saving}><CloseRoundedIcon /></button></div><form className="contact-form" onSubmit={saveFolder}><label>{t("Название")}<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} maxLength={120} required /></label><label>{t("Цвет")}<div className="color-input-row"><input type="color" value={form.color} onChange={event => setForm(current => ({ ...current, color: event.target.value }))} /><span>{form.color}</span></div></label>{formError && <div className="form-error">{t(formError)}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={closeModal} disabled={saving}>{t("Отмена")}</button><button className="primary-button" type="submit" disabled={saving}>{saving ? t("Сохранение…") : t("Сохранить")}</button></div></form></div></div>}
    </div>
  )
}

export default Folders
