import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type PageHeaderProps = { title: string; description: string; actions?: ReactNode; compact?: boolean; icon?: LucideIcon }

export function PageHeader({ title, description, actions, icon: Icon }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <h1>{Icon ? <Icon className="page-heading-icon" aria-hidden /> : null}{title}</h1>
      {actions ? <div className="page-heading-actions">{actions}</div> : null}
      <p>{description}</p>
    </div>
  )
}
