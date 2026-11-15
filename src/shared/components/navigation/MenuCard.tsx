import { Link } from 'react-router-dom'
import type { NavigationItem } from '@/shared/constants/navigation'

export function MenuCard({ item }: { item: NavigationItem }) {
  return (
    <Link to={item.path} className={`menu-card menu-card--${item.tone}`}>
      <span className="menu-card-icon"><item.icon aria-hidden strokeWidth={1.8} /></span>
      <span>{item.label}</span>
    </Link>
  )
}
