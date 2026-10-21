import type { ReactNode } from 'react'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { PageHeader } from '@/shared/components/navigation/PageHeader'

type FoundationPageProps = {
  title: string
  domain: string
  action?: ReactNode
}

export function FoundationPage({ title, domain, action }: FoundationPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={domain}
        actions={action}
      />
      <EmptyState
        title="Em breve"
        description="Este espaço ainda está em preparação."
      />
    </div>
  )
}
