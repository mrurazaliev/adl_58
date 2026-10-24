import { useTranslation } from 'react-i18next'
import { formatMoney } from '../finance'

type SummaryCardsProps = {
  net?: number
  theyOwe?: number
  iOwe?: number
  currency?: string
}

const SummaryCards = ({ net = 0, theyOwe = 0, iOwe = 0, currency = 'TJS' }: SummaryCardsProps) => {
  const { t } = useTranslation()
  const cards = [
    { label: t("Чистый итог"), value: formatMoney(net, currency), kind: 'net' },
    { label: t("Мне должны"), value: formatMoney(theyOwe, currency), kind: 'positive' },
    { label: t("Я должен"), value: formatMoney(iOwe, currency), kind: 'negative' }
  ]

  return (
    <div className="summary-grid">
      {cards.map(card => (
        <div key={t(card.label)} className={`summary-card ${card.kind}`}>
          <span>{t(card.label)}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default SummaryCards
