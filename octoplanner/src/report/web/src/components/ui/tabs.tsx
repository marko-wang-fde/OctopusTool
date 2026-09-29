import * as React from 'react'
import { cn } from '../../lib/utils'

export function Tabs({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-3', className)} {...props} />
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-flex h-9 items-center rounded-md border border-border bg-white p-1', className)} {...props} />
}

export function TabsTrigger({ className, active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={cn('rounded px-3 py-1 text-sm transition-colors', active ? 'bg-slate-100 text-foreground' : 'text-muted hover:text-foreground', className)} {...props} />
}
