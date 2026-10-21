import { Children, cloneElement, isValidElement, type HTMLAttributes, type ReactNode, type TableHTMLAttributes } from 'react'
import { cn } from '@/shared/utils/cn'

type TableElementProps = { children?: ReactNode; 'data-label'?: string }

function textContent(node: ReactNode): string {
  return Children.toArray(node).map((child) => {
    if (typeof child === 'string' || typeof child === 'number') return String(child)
    return isValidElement<TableElementProps>(child) ? textContent(child.props.children) : ''
  }).join('')
}

export function Table({ className, children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const sections = Children.toArray(children)
  const head = sections.find((child) => isValidElement(child) && child.type === 'thead')
  const labels = isValidElement<TableElementProps>(head)
    ? Children.toArray(head.props.children).flatMap((row) => isValidElement<TableElementProps>(row)
      ? Children.toArray(row.props.children).map(textContent) : [])
    : []
  const labeledSections = sections.map((section) => {
    if (!isValidElement<TableElementProps>(section) || section.type !== 'tbody') return section
    return cloneElement(section, {}, Children.map(section.props.children, (row) => {
      if (!isValidElement<TableElementProps>(row)) return row
      return cloneElement(row, {}, Children.map(row.props.children, (cell, index) => {
        if (!isValidElement<TableElementProps>(cell)) return cell
        return cloneElement(cell, { 'data-label': labels[index] ?? '' })
      }))
    }))
  })
  return (
    <div className="w-full min-w-0 rounded-md border border-border bg-surface">
      <table className={cn('responsive-table w-full border-collapse text-sm', className)} {...props}>
        {labeledSections}
      </table>
    </div>
  )
}

export function Th({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('border-b border-border px-3 py-3 text-left font-semibold', className)} {...props} />
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-border px-3 py-3 text-muted-foreground', className)} {...props} />
}
