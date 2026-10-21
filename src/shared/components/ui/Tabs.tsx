import { Children, isValidElement, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

type TabProps = ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean }

export function Tabs({ children }: { children: ReactNode }) {
  const buttonsRef = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children).filter(isValidElement<TabProps>)
  const useSelect = items.length > 4
  return <div className="min-w-0 max-w-full">
    {useSelect ? <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:hidden">
      Selecionar seção
      <select className="h-12 w-full rounded border border-border bg-surface px-3 text-base text-foreground" value={items.findIndex((item) => item.props.isActive)} onChange={(event) => buttonsRef.current?.querySelectorAll<HTMLButtonElement>('button')[Number(event.target.value)]?.click()}>
        <option value={-1} disabled>Selecione</option>
        {items.map((item, index) => <option key={item.key ?? index} value={index} disabled={item.props.disabled}>{item.props.children}</option>)}
      </select>
    </label> : null}
    <div ref={buttonsRef} className={cn('section-tabs', useSelect && 'hidden sm:flex')}>{children}</div>
  </div>
}

export function TabButton({ className, isActive, ...props }: TabProps) {
  return <button className={cn('min-h-12 min-w-0 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors', isActive && 'bg-surface text-foreground shadow-subtle', className)} aria-pressed={isActive} type="button" {...props} />
}
