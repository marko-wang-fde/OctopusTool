import * as React from 'react'
import { cn } from '../../lib/utils'

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-9 rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary', props.className)} {...props} />
}
