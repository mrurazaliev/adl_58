import { locale } from '../i18n'
import { useTranslation } from 'react-i18next'
import { useState, type FormEvent } from 'react'
import { isDemoMode } from '../demoStore'

const prototypeUsers = [
  { id: 'user-sample-1', username: 'sample_alfa' },
  { id: 'user-sample-2', username: 'sample_bravo' },
  { id: 'user-sample-3', username: 'sample_charlie' },
  { id: 'user-sample-4', username: 'sample_delta' },
  { id: 'user-sample-5', username: 'sample_echo' },
  { id: 'user-sample-6', username: 'sample_foxtrot' }
]

const Users = () => {
  const { t } = useTranslation()
  const demoMode = isDemoMode()
  const [users, setUsers] = useState(prototypeUsers)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('asc')
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [formError, setFormError] = useState('')
  const filtered = (demoMode ? users : [])
    .filter(user => user.username.toLocaleLowerCase(locale()).includes(search.trim().toLocaleLowerCase(locale())))
    .sort((a, b) => (sort === 'asc' ? 1 : -1) * a.username.localeCompare(b.username, locale()))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const addUser = (event: FormEvent) => {
    event.preventDefault()
    if (!demoMode) return
    const name = username.trim()
    if (!name) { setFormError('Введите имя пользователя.'); return }
    if (users.some(user => user.username.toLocaleLowerCase(locale()) === name.toLocaleLowerCase(locale()))) {
      setFormError('Такое имя пользователя уже существует.')
      return
    }
    setUsers(current => [...current, { id: crypto.randomUUID(), username: name }])
    setSearch('')
    setPage(1)
    setModalOpen(false)
    setUsername('')
    setFormError('')
  }

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="table-toolbar">
          <input aria-label={t("Поиск пользователей")} placeholder={t("Поиск пользователей")} value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} disabled={!demoMode} />
          <select aria-label={t("Сортировка пользователей")} value={sort} onChange={event => { setSort(event.target.value); setPage(1) }} disabled={!demoMode}><option value="asc">{t("По имени: А–Я")}</option><option value="desc">{t("По имени: Я–А")}</option></select>
          <div className="toolbar-spacer" />
          <button className="primary-button" disabled={!demoMode} onClick={() => { setUsername(''); setFormError(''); setModalOpen(true) }}>{t("Добавить пользователя")}</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t("Имя пользователя")}</th><th>{t("Роль")}</th><th>{t("Статус")}</th><th>{t("Действия")}</th></tr></thead>
            <tbody>
              {visible.map(user => <tr key={user.id}><td><strong>{user.username}</strong></td><td className="muted-value">{t("Не определена")}</td><td><span className="prototype-status">{t("Не определён")}</span></td><td><button className="icon-button" disabled aria-label={t("Действия для {{v0}} недоступны", { v0: user.username })}>⋯</button></td></tr>)}
              {!visible.length && <tr><td colSpan={4}><div className="empty-state"><strong>{demoMode ? t("Ничего не найдено") : t('Пользователей пока нет')}</strong>{demoMode && <span>{t("Попробуйте изменить поиск.")}</span>}</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="prototype-pagination">
          <label>{t("Строк на странице")} <select aria-label={t("Строк на странице")} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1) }} disabled={!demoMode}>{[5, 10, 25].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
          <span role="status">{t('{{from}}–{{to}} из {{total}}', { from: filtered.length ? (currentPage - 1) * pageSize + 1 : 0, to: Math.min(currentPage * pageSize, filtered.length), total: filtered.length })}</span>
          <nav aria-label={t("Страницы пользователей")}><button className="secondary-button" disabled={!demoMode || currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t("Назад")}</button><span>{t('Страница {{page}} из {{pages}}', { page: currentPage, pages: pageCount })}</span><button className="secondary-button" disabled={!demoMode || currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>{t("Далее")}</button></nav>
        </div>
      </section>
      {demoMode && modalOpen && <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && setModalOpen(false)}><div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="prototype-user-title">
        <div className="modal-heading"><h3 id="prototype-user-title">{t("Добавить пользователя")}</h3><button className="icon-button" aria-label={t("Закрыть")} onClick={() => setModalOpen(false)}>×</button></div>
        <form className="contact-form" onSubmit={addUser}><label>{t("Имя пользователя")}<input autoFocus value={username} onChange={event => setUsername(event.target.value)} maxLength={120} required /></label>{formError && <div className="form-error" role="alert">{t(formError)}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>{t("Отмена")}</button><button className="primary-button" type="submit">{t("Сохранить")}</button></div></form>
      </div></div>}
    </div>
  )
}

export default Users
