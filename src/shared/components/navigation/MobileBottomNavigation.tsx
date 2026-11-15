import { NavLink } from 'react-router-dom'
import { useAuth } from '@/app/providers/AuthProvider'
import { canAccessModule } from '@/app/auth/permissions'
import { navigationItems } from '@/shared/constants/navigation'
import { cn } from '@/shared/utils/cn'

export function MobileBottomNavigation() {
  const { roles } = useAuth()
  const items = navigationItems.filter((item) => ['/', '/agenda'].includes(item.path) && canAccessModule(roles, item.module))
  return (
    <nav className="mobile-navigation menu-bottom-navigation fixed inset-x-0 bottom-0 z-30 flex lg:hidden" aria-label="Atalhos principais">
      {items.map((item) => (
        <NavLink key={item.path} to={item.path} end={item.path === '/'}
          className={({ isActive }) => cn('menu-bottom-link', isActive && 'menu-bottom-link--active')}>
          <item.icon aria-hidden className="h-6 w-6" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
