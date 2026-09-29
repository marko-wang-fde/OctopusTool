import * as React from 'react'

export function Tooltip({ title, children }: { title: string; children: React.ReactNode }) {
  return <span title={title}>{children}</span>
}
