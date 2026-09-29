import * as React from 'react'
import { cn } from '../../lib/utils'

export function Sheet({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null
  return <div className="fixed inset-0 z-50 bg-black/20">{children}</div>
}

export function SheetContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ml-auto h-full w-full max-w-xl overflow-auto bg-white p-5 shadow-xl', className)} {...props} />
}
