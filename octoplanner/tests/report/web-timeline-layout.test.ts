import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('report web timeline layout', () => {
  it('styles sanitized vis-timeline item content and fits group height to items', () => {
    const styles = readFileSync(path.resolve('src/report/web/src/styles.css'), 'utf8')
    const page = readFileSync(path.resolve('src/report/web/src/pages/ResourceTimelinePage.tsx'), 'utf8')

    expect(styles).toContain('.report-timeline .vis-item .vis-item-content')
    expect(styles).not.toContain('.report-timeline .timeline-item {')
    expect(page).toContain("groupHeightMode: 'fitItems'")
    expect(page).toContain('requestAnimationFrame')
    expect(page).toContain('24 * 366')
    expect(page).not.toContain('24 * 14')
  })
})
