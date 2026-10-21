import type { ReactNode } from 'react'

type PageHeaderProps = { title: string; description: string; actions?: ReactNode; compact?: boolean }

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {actions ? <div className="page-heading-actions">{actions}</div> : null}
      <p>{description}</p>
    </div>
  )
}
