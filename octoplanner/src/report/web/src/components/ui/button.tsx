import * as React from 'react'
import { cn } from '../../lib/utils'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'ghost' | 'outline'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', type = 'button', ...props }, ref) => {
    const variantClass = {
      default: 'bg-primary text-white hover:bg-blue-700',
      ghost: 'bg-transparent text-foreground hover:bg-slate-100',
      outline: 'border border-border bg-white text-foreground hover:bg-slate-50'
    }[variant]

    return (
      <button
        ref={ref}
        type={type}
        className={cn('inline-flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:pointer-events-none disabled:opacity-50', variantClass, className)}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
