import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import AppearanceControls from './AppearanceControls'

interface AuthCardProps {
  title: string
  sideText: string
  sideLink: string
  sidePath: string
  children: ReactNode
}

const AuthCard = ({ title, sideText, sideLink, sidePath, children }: AuthCardProps) => {
  const { t } = useTranslation()
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-controls-row"><Link className="auth-brand" to="/"><span>5:8</span> Adl</Link><AppearanceControls /></div>
        <div className="auth-title-row">
          <h1>{t(title)}</h1>
          <p>{sideText} <Link to={sidePath}>{sideLink}</Link></p>
        </div>
        {children}
      </div>
    </div>
  )
}

export default AuthCard
