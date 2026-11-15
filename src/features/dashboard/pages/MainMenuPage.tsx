import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { canAccessModule } from '@/app/auth/permissions'
import { navigationItems } from '@/shared/constants/navigation'
import { MenuCard } from '@/shared/components/navigation/MenuCard'

export default function MainMenuPage() {
  const { roles } = useAuth()
  const items = navigationItems.filter((item) => item.tone && canAccessModule(roles, item.module))
  const overview = navigationItems.find((item) => item.path === '/visao-geral')!
  return (
    <div className="main-menu">
      <header className="main-menu-intro">
        <span className="main-menu-flourish" aria-hidden><i /><i /><i /></span>
        <h1>Menu Principal</h1>
        <p>Gerencie sua escola de forma prática e criativa.</p>
      </header>
      <nav className="main-menu-grid" aria-label="Módulos da escola">
        {items.map((item) => <MenuCard key={item.path} item={item} />)}
      </nav>
      {canAccessModule(roles, overview.module) && (
        <Link className="main-menu-overview" to={overview.path}>
          <overview.icon aria-hidden className="h-5 w-5 shrink-0" />
          <span><strong>{overview.label}</strong><small>Acompanhe as atividades e os indicadores da escola</small></span>
          <ArrowRight aria-hidden className="ml-auto h-5 w-5 shrink-0" />
        </Link>
      )}
    </div>
  )
}
