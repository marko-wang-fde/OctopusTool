export type Locale = 'zh-CN' | 'en-US'

export type WebMessages = {
  appTitle: string
  readOnly: string
  plans: string
  timeline: string
  requirements: string
  exceptions: string
  rules: string
  scenarios: string
  diff: string
  moved: string
  added: string
  removed: string
  before: string
  after: string
  externalRef: string
  loading: string
  error: string
  selectPlan: string
  latest: string
  planned: string
  unplanned: string
  warnings: string
  notModeled: string
  metrics: string
  operation: string
  requirement: string
  item: string
  resource: string
  start: string
  end: string
  state: string
  severity: string
  reason: string
  nextAction: string
  candidates: string
  orderFilter: string
  allOrders: string
}

const messages: Record<Locale, WebMessages> = {
  'zh-CN': {
    appTitle: 'Octoplanner 报表',
    readOnly: '只读',
    plans: '计划',
    timeline: '资源时间线',
    requirements: '需求',
    exceptions: '异常',
    rules: '规则',
    scenarios: '场景',
    diff: '计划差异',
    moved: '移动',
    added: '新增',
    removed: '移除',
    before: '调整前',
    after: '调整后',
    externalRef: '来源引用',
    loading: '加载中',
    error: '加载失败',
    selectPlan: '选择计划',
    latest: '最新',
    planned: '已排',
    unplanned: '未排',
    warnings: '警告',
    notModeled: '未建模',
    metrics: '指标',
    operation: '工序',
    requirement: '需求',
    item: '物料',
    resource: '资源',
    start: '开始',
    end: '结束',
    state: '状态',
    severity: '严重度',
    reason: '原因',
    nextAction: '建议动作',
    candidates: '候选计划',
    orderFilter: '订单筛选',
    allOrders: '全部订单'
  },
  'en-US': {
    appTitle: 'Octoplanner Report',
    readOnly: 'Read-only',
    plans: 'Plans',
    timeline: 'Resource timeline',
    requirements: 'Requirements',
    exceptions: 'Exceptions',
    rules: 'Rules',
    scenarios: 'Scenarios',
    diff: 'Plan diff',
    moved: 'Moved',
    added: 'Added',
    removed: 'Removed',
    before: 'Before',
    after: 'After',
    externalRef: 'External reference',
    loading: 'Loading',
    error: 'Failed to load',
    selectPlan: 'Select plan',
    latest: 'Latest',
    planned: 'Planned',
    unplanned: 'Unplanned',
    warnings: 'Warnings',
    notModeled: 'Not modeled',
    metrics: 'Metrics',
    operation: 'Operation',
    requirement: 'Requirement',
    item: 'Item',
    resource: 'Resource',
    start: 'Start',
    end: 'End',
    state: 'State',
    severity: 'Severity',
    reason: 'Reason',
    nextAction: 'Next action',
    candidates: 'Candidates',
    orderFilter: 'Order filter',
    allOrders: 'All orders'
  }
}

export function getMessages(locale: string | undefined): WebMessages {
  return messages[locale === 'en-US' ? 'en-US' : 'zh-CN']
}
