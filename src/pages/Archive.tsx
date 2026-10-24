import { locale } from '../i18n'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { isDemoMode } from '../demoStore'
import { formatMoney } from '../finance'

const prototypeRows = [
  { id: 'archive-sample-1', name: 'Пример контакта А', direction: 'Мне должны', folder: 'Пример папки', amount: 1500, progress: 0, description: 'Образец закрытой записи без погашения' },
  { id: 'archive-sample-2', name: 'Пример контакта Б', direction: 'Я должен', folder: '', amount: 800, progress: 50, description: 'Образец частичного погашения' },
  { id: 'archive-sample-3', name: 'Пример контакта В', direction: 'Мне должны', folder: 'Пример папки', amount: 2000, progress: 100, description: 'Образец полного погашения' }
]

const Archive = () => {
  const { t } = useTranslation()
  const demoMode = isDemoMode()
  const [search, setSearch] = useState('')
  const [contactFilter, setContactFilter] = useState('all')
  const [folderFilter, setFolderFilter] = useState('all')
  const [sort, setSort] = useState('name')
  const rows = demoMode ? prototypeRows : []
  const filtered = rows.filter(row => {
    const value = search.trim().toLocaleLowerCase(locale())
    return (!value || `${row.name} ${row.direction} ${row.description}`.toLocaleLowerCase(locale()).includes(value))
      && (contactFilter === 'all' || row.id === contactFilter)
      && (folderFilter === 'all' || (folderFilter === 'none' ? !row.folder : row.folder === folderFilter))
  }).sort((a, b) => sort === 'amount' ? b.amount - a.amount : sort === 'progress' ? b.progress - a.progress : a.name.localeCompare(b.name, locale()))

  return (
    <div className="page-stack">
      <section className="panel">
        <div className="table-toolbar">
          <input aria-label={t("Поиск в архиве")} placeholder={t("Поиск")} value={search} onChange={event => setSearch(event.target.value)} disabled={!demoMode} />
          <select aria-label={t("Контакт архива")} value={contactFilter} onChange={event => setContactFilter(event.target.value)} disabled={!demoMode}><option value="all">{t("Все контакты")}</option>{rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
          <select aria-label={t("Папка архива")} value={folderFilter} onChange={event => setFolderFilter(event.target.value)} disabled={!demoMode}><option value="all">{t("Все папки")}</option><option value="none">{t("Без папки")}</option>{[...new Set(rows.map(row => row.folder).filter(Boolean))].map(folder => <option key={folder} value={folder}>{folder}</option>)}</select>
          <select aria-label={t("Сортировка архива")} value={sort} onChange={event => setSort(event.target.value)} disabled={!demoMode}><option value="name">{t("По имени")}</option><option value="amount">{t("По общей сумме")}</option><option value="progress">{t("По прогрессу")}</option></select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t("Полное имя / направление")}</th><th>{t("Общая сумма")}</th><th>{t("Прогресс")}</th><th>{t("Описание")}</th><th>{t("Статус")}</th><th>{t("Действия")}</th></tr></thead>
            <tbody>
              {filtered.map(row => <tr key={row.id}>
                <td><div className="contact-name-cell"><strong>{row.name}</strong><span>{t(row.direction)}</span></div></td>
                <td>{formatMoney(row.amount)}</td>
                <td><div className="progress-cell"><div className="progress-track" role="progressbar" aria-label={t("Прогресс {{v0}}", { v0: row.name })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.progress}><i style={{ width: `${row.progress}%` }} /></div><span>{row.progress}%</span></div></td>
                <td>{row.description}</td><td><span className="prototype-status">{t('Закрыт')}</span></td>
                <td><button className="icon-button" disabled aria-label={t("Действия для {{v0}} недоступны", { v0: row.name })}>⋯</button></td>
              </tr>)}
              {!filtered.length && <tr><td colSpan={6}><div className="empty-state"><strong>{demoMode ? t("Ничего не найдено") : t('Архив пуст')}</strong>{demoMode && <span>{t("Попробуйте изменить поиск или фильтры.")}</span>}</div></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Archive
