import type { ReportLocale } from './locale'

export type ReportMessages = {
  app: {
    title: string
    readOnly: string
    generatedAt: string
    language: string
  }
  navigation: {
    plans: string
    resourceTimeline: string
    requirements: string
    exceptions: string
    rules: string
    scenarios: string
  }
  reportTitles: {
    planOverview: string
    resourceTimeline: string
    requirementTrace: string
    exceptionReview: string
    ruleImpact: string
    planDiff: string
    scenarioCompare: string
  }
  tableHeaders: {
    id: string
    name: string
    state: string
    requirementId: string
    itemId: string
    operationId: string
    resourceId: string
    startAt: string
    endAt: string
    dueAt: string
    priority: string
    quantity: string
    customer: string
    type: string
    severity: string
    reason: string
    nextAction: string
    ruleId: string
    ruleType: string
    changeType: string
    before: string
    after: string
    externalRef: string
  }
  status: {
    active: string
    archived: string
    locked: string
    planned: string
    unplanned: string
    warning: string
    blocked: string
    info: string
  }
  empty: {
    noPlans: string
    noOperations: string
    noRequirements: string
    noExceptions: string
    noRules: string
    noScenarios: string
  }
  actions: {
    refresh: string
    export: string
    filter: string
    openDetails: string
    back: string
  }
  nextActions: {
    inspectRouting: string
    inspectRule: string
    inspectModelingGap: string
    inspectWarning: string
  }
}

export const reportMessages: Record<ReportLocale, ReportMessages> = {
  'zh-CN': {
    app: {
      title: 'Octoplanner 报表',
      readOnly: '只读报表',
      generatedAt: '生成时间',
      language: '语言'
    },
    navigation: {
      plans: '计划',
      resourceTimeline: '资源时间线',
      requirements: '需求',
      exceptions: '异常',
      rules: '规则',
      scenarios: '场景'
    },
    reportTitles: {
      planOverview: '计划总览',
      resourceTimeline: '资源时间线',
      requirementTrace: '需求追踪',
      exceptionReview: '异常审查',
      ruleImpact: '规则影响',
      planDiff: '计划差异',
      scenarioCompare: '场景对比'
    },
    tableHeaders: {
      id: 'ID',
      name: '名称',
      state: '状态',
      requirementId: '需求',
      itemId: '物料',
      operationId: '工序',
      resourceId: '资源',
      startAt: '开始时间',
      endAt: '结束时间',
      dueAt: '交期',
      priority: '优先级',
      quantity: '数量',
      customer: '客户',
      type: '类型',
      severity: '严重度',
      reason: '原因',
      nextAction: '建议动作',
      ruleId: '规则',
      ruleType: '规则类型',
      changeType: '变更类型',
      before: '调整前',
      after: '调整后',
      externalRef: '来源引用'
    },
    status: {
      active: '生效',
      archived: '已归档',
      locked: '已锁定',
      planned: '已排',
      unplanned: '未排',
      warning: '警告',
      blocked: '阻塞',
      info: '信息'
    },
    empty: {
      noPlans: '暂无计划',
      noOperations: '暂无工序',
      noRequirements: '暂无需求',
      noExceptions: '暂无异常',
      noRules: '暂无规则',
      noScenarios: '暂无场景'
    },
    actions: {
      refresh: '刷新',
      export: '导出',
      filter: '筛选',
      openDetails: '查看详情',
      back: '返回'
    },
    nextActions: {
      inspectRouting: '检查工艺路线、资源候选或工时是否完整',
      inspectRule: '检查相关规则是否仍然有效',
      inspectModelingGap: '补充模型缺口后重新生成计划',
      inspectWarning: '查看警告详情并确认是否影响交付'
    }
  },
  'en-US': {
    app: {
      title: 'Octoplanner Report',
      readOnly: 'Read-only report',
      generatedAt: 'Generated at',
      language: 'Language'
    },
    navigation: {
      plans: 'Plans',
      resourceTimeline: 'Resource timeline',
      requirements: 'Requirements',
      exceptions: 'Exceptions',
      rules: 'Rules',
      scenarios: 'Scenarios'
    },
    reportTitles: {
      planOverview: 'Plan overview',
      resourceTimeline: 'Resource timeline',
      requirementTrace: 'Requirement trace',
      exceptionReview: 'Exception review',
      ruleImpact: 'Rule impact',
      planDiff: 'Plan diff',
      scenarioCompare: 'Scenario compare'
    },
    tableHeaders: {
      id: 'ID',
      name: 'Name',
      state: 'State',
      requirementId: 'Requirement',
      itemId: 'Item',
      operationId: 'Operation',
      resourceId: 'Resource',
      startAt: 'Start',
      endAt: 'End',
      dueAt: 'Due',
      priority: 'Priority',
      quantity: 'Quantity',
      customer: 'Customer',
      type: 'Type',
      severity: 'Severity',
      reason: 'Reason',
      nextAction: 'Next action',
      ruleId: 'Rule',
      ruleType: 'Rule type',
      changeType: 'Change type',
      before: 'Before',
      after: 'After',
      externalRef: 'External reference'
    },
    status: {
      active: 'Active',
      archived: 'Archived',
      locked: 'Locked',
      planned: 'Planned',
      unplanned: 'Unplanned',
      warning: 'Warning',
      blocked: 'Blocked',
      info: 'Info'
    },
    empty: {
      noPlans: 'No plans',
      noOperations: 'No operations',
      noRequirements: 'No requirements',
      noExceptions: 'No exceptions',
      noRules: 'No rules',
      noScenarios: 'No scenarios'
    },
    actions: {
      refresh: 'Refresh',
      export: 'Export',
      filter: 'Filter',
      openDetails: 'Open details',
      back: 'Back'
    },
    nextActions: {
      inspectRouting: 'Inspect routing, eligible resources, and duration data',
      inspectRule: 'Inspect whether the related rule is still valid',
      inspectModelingGap: 'Fill the modeling gap and create a new plan',
      inspectWarning: 'Review the warning details and confirm delivery impact'
    }
  }
}

export function getReportMessages(locale: ReportLocale): ReportMessages {
  return reportMessages[locale]
}
