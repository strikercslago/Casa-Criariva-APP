import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

type EmptyStateProps = {
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ui-empty-state flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface px-5 py-6 text-center">
      <span className="ui-empty-icon" aria-hidden><Search className="h-6 w-6" /></span>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
