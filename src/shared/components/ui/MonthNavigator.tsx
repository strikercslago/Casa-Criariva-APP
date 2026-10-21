import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { IconButton } from './IconButton'

type MonthNavigatorProps = { value: string; onChange: (value: string) => void; onPrevious: () => void; onNext: () => void; onToday: () => void }
export function MonthNavigator({ value, onChange, onPrevious, onNext, onToday }: MonthNavigatorProps) {
  return <div className="grid gap-2">
    <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] gap-2">
      <IconButton label="Mes anterior" onClick={onPrevious}><ChevronLeft className="h-4 w-4" aria-hidden /></IconButton>
      <Button onClick={onToday} variant="ghost">Mês atual</Button>
      <IconButton label="Proximo mes" onClick={onNext}><ChevronRight className="h-4 w-4" aria-hidden /></IconButton>
    </div>
    <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Mês de referência
      <input aria-label="Selecionar mes" className="h-12 w-full rounded border border-border bg-surface px-3 text-base text-foreground" type="month" value={value.slice(0, 7)} onChange={(event) => { if (event.target.value) onChange(`${event.target.value}-01`) }} />
    </label>
  </div>
}
