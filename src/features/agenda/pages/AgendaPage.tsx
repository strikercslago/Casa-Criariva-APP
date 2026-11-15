import { lazy, Suspense, useState } from 'react'
import { TabButton, Tabs } from '@/shared/components/ui/Tabs'
import ClassAgendaPage from './ClassAgendaPage'

const GoogleCalendarPanel = lazy(() => import('../google/GoogleCalendarPanel'))

export default function AgendaPage() {
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).has('google') ? 'google' : 'classes')
  return <div className="space-y-4">
    <Tabs><TabButton isActive={section === 'classes'} onClick={() => setSection('classes')}>Aulas</TabButton>
      <TabButton isActive={section === 'google'} onClick={() => setSection('google')}>Compromissos Google</TabButton></Tabs>
    {section === 'classes' ? <ClassAgendaPage /> : <Suspense fallback={<p role="status">Carregando agenda…</p>}><GoogleCalendarPanel /></Suspense>}
  </div>
}
