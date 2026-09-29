import * as React from 'react'
import { cn } from '../../lib/utils'

export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'outline' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        variant === 'outline' ? 'border border-border bg-white text-foreground' : 'bg-slate-100 text-slate-700',
        className
      )}
      {...props}
    />
  )
}
