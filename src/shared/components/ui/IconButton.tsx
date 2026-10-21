import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/utils/cn'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
}

export function IconButton({ className, label, children, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={cn(
        'ui-icon-button inline-flex h-12 w-12 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded border border-border bg-surface text-foreground shadow-subtle transition-colors hover:bg-muted active:bg-muted/80 disabled:pointer-events-none disabled:opacity-60',
        className,
      )}
      title={label}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}
