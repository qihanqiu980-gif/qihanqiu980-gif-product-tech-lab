import type { Component } from 'vue'
import type { DailyCourse, DayId } from './types'

export interface DailyCourseRendererImplementation {
  readonly kind: 'renderer'
  readonly key: string
  readonly dayId: DayId
  readonly load: () => Promise<{ default: Component }>
}

export interface DailyCourseExperimentAdapter {
  readonly kind: 'experiment'
  readonly key: string
  readonly dayId: DayId
  readonly validateLesson: (lesson: DailyCourse) => readonly string[]
}

export interface DailyCourseEvidenceAdapter {
  readonly kind: 'evidence'
  readonly key: string
  readonly dayId: DayId
  readonly schemaVersion: number
  readonly validateLesson: (lesson: DailyCourse) => readonly string[]
}

export interface DailyCourseImplementation {
  readonly dayId: DayId
  readonly renderer: DailyCourseRendererImplementation
  readonly experimentAdapter: DailyCourseExperimentAdapter
  readonly evidenceAdapter: DailyCourseEvidenceAdapter
  readonly reviewed: boolean
}

export interface DailyCourseImplementationIssue {
  readonly code:
    | 'implementation-missing'
    | 'content-missing'
    | 'content-day-mismatch'
    | 'renderer-kind-mismatch'
    | 'renderer-day-mismatch'
    | 'renderer-loader-missing'
    | 'experiment-kind-mismatch'
    | 'experiment-day-mismatch'
    | 'experiment-validator-missing'
    | 'experiment-contract-failed'
    | 'evidence-kind-mismatch'
    | 'evidence-day-mismatch'
    | 'evidence-validator-missing'
    | 'evidence-schema-missing'
    | 'evidence-contract-failed'
  readonly message: string
}

export interface DailyCourseImplementationInspection {
  readonly dayId: DayId
  readonly implementation?: DailyCourseImplementation
  readonly resolved: boolean
  readonly issues: readonly DailyCourseImplementationIssue[]
}

function missingConceptIds(lesson: DailyCourse, required: readonly string[]): string[] {
  const available = new Set(lesson.concepts.map((concept) => concept.id))
  return required.filter((conceptId) => !available.has(conceptId))
}

function validateW1D1Experiment(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W1D1') issues.push(`实验仅适配 W1D1，实际课程为 ${lesson.id}。`)

  const guidedRequired = ['javascript', 'dom', 'user-event', 'page-state']
  const guidedConcepts = new Set(lesson.guidedLab.conceptIds)
  const missingGuided = guidedRequired.filter((conceptId) => !guidedConcepts.has(conceptId))
  if (missingGuided.length) issues.push(`教学沙盒缺少引导实验概念：${missingGuided.join('、')}。`)

  const independentRequired = ['dom', 'user-event', 'page-state', 'front-end-boundary']
  const independentConcepts = new Set(lesson.independentLab.conceptIds)
  const missingIndependent = independentRequired.filter((conceptId) => !independentConcepts.has(conceptId))
  if (missingIndependent.length) issues.push(`教学沙盒缺少独立变式概念：${missingIndependent.join('、')}。`)

  const missingLessonConcepts = missingConceptIds(lesson, [...guidedRequired, ...independentRequired])
  if (missingLessonConcepts.length) issues.push(`教学沙盒引用了课程未教学概念：${[...new Set(missingLessonConcepts)].join('、')}。`)
  return issues
}

function validateW1D1Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W1D1') issues.push(`证据适配器仅适配 W1D1，实际课程为 ${lesson.id}。`)

  const evidenceConceptIds = ['javascript', 'dom', 'user-event', 'page-state', 'front-end-boundary']
  const missingEvidenceConcepts = missingConceptIds(lesson, evidenceConceptIds)
  if (missingEvidenceConcepts.length) issues.push(`证据适配器引用了课程未教学概念：${missingEvidenceConcepts.join('、')}。`)

  if (lesson.exercises.length > 4) {
    issues.push(`W1D1 证据记录器只处理前 4 道练习，课程却登记了 ${lesson.exercises.length} 道。`)
  }
  for (const mode of ['30', '45'] as const) {
    if (lesson.learningPaths[mode].exerciseCount > 4) {
      issues.push(`${mode} 分钟路径要求 ${lesson.learningPaths[mode].exerciseCount} 道练习，超过证据记录器的 4 道上限。`)
    }
  }
  const foreignExerciseIds = lesson.exercises.filter((exercise) => !exercise.id.startsWith('w1d1-')).map((exercise) => exercise.id)
  if (foreignExerciseIds.length) issues.push(`证据适配器发现非 W1D1 练习 ID：${foreignExerciseIds.join('、')}。`)
  return issues
}

function validateW1D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = ['url', 'domain-name', 'dns', 'server-address', 'port', 'transport-protocol', 'path-query']
  const issues: string[] = []
  if (lesson.id !== 'W1D2') issues.push(`实验仅适配 W1D2，实际课程为 ${lesson.id}。`)
  const ids = new Set(lesson.guidedLab.conceptIds)
  const missing = required.filter((id) => !ids.has(id))
  if (missing.length) issues.push(`寻址实验缺少概念：${missing.join('、')}。`)
  const independentIds = new Set(lesson.independentLab.conceptIds)
  const missingIndependent = required.filter((id) => !independentIds.has(id))
  if (missingIndependent.length) issues.push(`独立寻址变式缺少概念：${missingIndependent.join('、')}。`)
  return issues
}

function validateW1D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W1D2') issues.push(`证据适配器仅适配 W1D2，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w1d2-'))) {
    issues.push('W1D2 证据适配器要求练习 ID 使用 w1d2- 前缀。')
  }
  return issues
}

function validateW1D3Experiment(lesson: DailyCourse): readonly string[] {
  const required = ['http-message', 'http-request', 'http-response', 'method-url', 'header-cookie-query', 'payload', 'status-response', 'timing-size']
  const issues: string[] = []
  if (lesson.id !== 'W1D3') issues.push(`实验仅适配 W1D3，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['引导 HTTP 实验', lesson.guidedLab.conceptIds], ['独立 HTTP 变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  return issues
}

function validateW1D3Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W1D3') issues.push(`证据适配器仅适配 W1D3，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w1d3-'))) {
    issues.push('W1D3 证据适配器要求练习 ID 使用 w1d3- 前缀。')
  }
  return issues
}

function validateW1D4Experiment(lesson: DailyCourse): readonly string[] {
  const required = ['api-entry', 'request-handler', 'backend-service', 'business-rule', 'database-read-write', 'persistence-boundary', 'response-assembly']
  const issues: string[] = []
  if (lesson.id !== 'W1D4') issues.push(`实验仅适配 W1D4，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['引导请求处理链实验', lesson.guidedLab.conceptIds], ['独立持久化变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['教学模拟', 'API', '业务规则', '数据库', 'Response']) {
    if (!serialized.includes(phrase)) issues.push(`W1D4 实验缺少专属链路标识：${phrase}。`)
  }
  return issues
}

function validateW1D4Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W1D4') issues.push(`证据适配器仅适配 W1D4，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w1d4-'))) {
    issues.push('W1D4 证据适配器要求练习 ID 使用 w1d4- 前缀。')
  }
  if (lesson.deliverable.title !== '请求处理链路说明') issues.push('W1D4 今日成果必须是“请求处理链路说明”。')
  if (!lesson.memory.reviewStages.every((stage) => stage.task.trim().length >= 8)) issues.push('W1D4 复习排程缺少真实任务。')
  return issues
}

function validateW1D5Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'network-request-entry', 'network-name-url', 'network-method-status-type', 'network-initiator',
    'network-headers', 'network-payload-response', 'network-timing', 'network-size-cache', 'network-evidence-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W1D5') issues.push(`实验仅适配 W1D5，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['Network 引导观察器', lesson.guidedLab.conceptIds], ['Network 独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['正常', '4xx', '5xx', 'Timing', 'Size', 'Initiator', '缓存', '教学模拟']) {
    if (!serialized.includes(phrase)) issues.push(`W1D5 观察器缺少必测变式：${phrase}。`)
  }
  return issues
}

function validateW1D5Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W1D5') issues.push(`证据适配器仅适配 W1D5，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w1d5-'))) issues.push('W1D5 证据适配器要求练习 ID 使用 w1d5- 前缀。')
  if (lesson.deliverable.title !== 'Network 观察记录') issues.push('W1D5 今日成果必须是“Network 观察记录”。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['看到', '可以推断', '还不能证明', '下一步']) {
    if (!deliverable.includes(phrase)) issues.push(`W1D5 成果缺少证据边界字段：${phrase}。`)
  }
  if (!lesson.memory.reviewStages.every((stage) => stage.task.trim().length >= 8)) issues.push('W1D5 复习排程缺少真实任务。')
  return issues
}

function validateW3D1Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'terminal-shell', 'working-directory', 'file-path', 'safe-lab-copy',
    'sqlite-database-file', 'sqlite3-session', 'setup-sql-script', 'table-row-column-preview',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W3D1') issues.push(`实验仅适配 W3D1，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['SQLite 环境六路径引导实验', lesson.guidedLab.conceptIds], ['SQLite 环境独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram, deliverable: lesson.deliverable })
  for (const phrase of ['当前目录', '只读素材', 'sqlite3', 'setup.sql', 'orders 表', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W3D1 SQLite 环境观察器缺少必测路径或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已完成', 'JOIN 已完成', '聚合结果正确', '新人券收入已经正确']) {
    if (serialized.includes(forbidden)) issues.push(`W3D1 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D1Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W3D1') issues.push(`证据适配器仅适配 W3D1，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w3d1-'))) issues.push('W3D1 证据适配器要求练习 ID 使用 w3d1- 前缀。')
  if (lesson.title !== '打开 SQLite 实验环境') issues.push('W3D1 课程标题必须是“打开 SQLite 实验环境”。')
  if (lesson.deliverable.title !== 'SQL 实验环境记录') issues.push('W3D1 今日成果必须是“SQL 实验环境记录”。')
  if (lesson.nextLesson?.id !== 'W3D2') issues.push('W3D1 只能说明下一课 W3D2，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W3D1 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['lab_root', 'source_package', 'working_copy', 'terminal_command', 'current_directory', 'database_file', 'setup_script', 'sqlite3_check', 'schema_preview', 'first_row_preview', 'safety_boundary', 'cannot_prove', 'next_step']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D1 成果合同缺少字段：${phrase}。`)
  }
  for (const phrase of ['教学模拟', 'answers.sql', 'W3D2', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D1 成果合同缺少边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已完成', '聚合已完成', '新人券收入已经正确', '真实生产订单已证明']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W3D1 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'sql-statement', 'select-clause', 'from-clause', 'where-gate',
    'order-by-stage', 'limit-stage', 'execution-order', 'result-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W3D2') issues.push(`实验仅适配 W3D2，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['SELECT 顺序六路径引导实验', lesson.guidedLab.conceptIds], ['SELECT 顺序独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['missing-from', 'where-before-source', 'select-column-mismatch', 'order-without-rule', 'limit-overclaim', 'qualified-select-order', 'FROM', 'WHERE', 'SELECT', 'ORDER BY', 'LIMIT', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W3D2 SELECT 顺序观察器缺少必测路径、阶段或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '当天收入已经算出', '真实生产订单已经证明']) {
    if (serialized.includes(forbidden)) issues.push(`W3D2 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W3D2') issues.push(`证据适配器仅适配 W3D2，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w3d2-'))) issues.push('W3D2 证据适配器要求练习 ID 使用 w3d2- 前缀。')
  if (lesson.title !== 'SELECT 执行逻辑') issues.push('W3D2 课程标题必须是“SELECT 执行逻辑”。')
  if (lesson.deliverable.title !== 'SQL 执行顺序图') issues.push('W3D2 今日成果必须是“SQL 执行顺序图”。')
  if (lesson.nextLesson?.id !== 'W3D3') issues.push('W3D2 只能说明下一课 W3D3，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W3D2 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['business_question', 'base_table', 'source_rows', 'where_gate', 'select_columns', 'sort_rule', 'limit_window', 'execution_order', 'observed_result', 'can_prove', 'cannot_prove', 'next_sql_task', 'sql-execution-order.md']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D2 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['FROM', 'WHERE', 'SELECT', 'ORDER BY', 'LIMIT', '教学模拟', 'W3D3', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D2 成果合同缺少阶段、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产订单已经证明', '当天收入已经算出']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W3D2 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D3Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'query-question', 'where-condition', 'comparison-operator', 'text-value-filter',
    'date-range-boundary', 'order-direction', 'column-alias', 'distinct-result',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W3D3') issues.push(`实验仅适配 W3D3，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['基础查询六道正向查询引导实验', lesson.guidedLab.conceptIds], ['基础查询独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['q1-paid-orders', 'q2-app-channel-orders', 'q3-orders-on-20260831', 'q4-recent-paid-orders', 'q5-paid-time-alias', 'q6-distinct-channels', '业务问题', 'SQL', '预期留下', '实际看到', '能证明', '不能证明', 'WHERE', 'ORDER BY', 'AS', 'DISTINCT', 'self_check.sql', 'answers.sql', '教学模拟']) {
    if (!serialized.includes(phrase)) issues.push(`W3D3 基础查询观察器缺少必测路径、动作或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产订单已经证明', '数据质量诊断已经完成', '渠道指标已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W3D3 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D3Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W3D3') issues.push(`证据适配器仅适配 W3D3，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w3d3-'))) issues.push('W3D3 证据适配器要求练习 ID 使用 w3d3- 前缀。')
  if (lesson.title !== '用户与订单基础查询') issues.push('W3D3 课程标题必须是“用户与订单基础查询”。')
  if (lesson.deliverable.title !== '6 道基础查询') issues.push('W3D3 今日成果必须是“6 道基础查询”。')
  if (lesson.nextLesson?.id !== 'W3D4') issues.push('W3D3 只能说明下一课 W3D4，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W3D3 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['basic-sql-queries.sql', 'basic-query-log.md', 'query_id', 'business_question', 'base_table', 'selected_columns', 'filter_condition', 'date_boundary', 'sort_rule', 'alias_used', 'distinct_rule', 'sql_text', 'observed_result', 'can_prove', 'cannot_prove', 'self_check_result', 'next_sql_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D3 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['WHERE', 'ORDER BY', 'AS', 'DISTINCT', '教学模拟', 'answers.sql', 'self_check.sql', 'W3D4', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D3 成果合同缺少查询动作、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产订单已经证明', '数据质量诊断已经完成', '渠道指标已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W3D3 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D4Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'quality-question', 'null-value', 'duplicate-row', 'status-coverage',
    'test-data-flag', 'time-boundary-risk', 'amount-anomaly', 'quality-evidence-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W3D4') issues.push(`实验仅适配 W3D4，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['数据质量六条检查引导实验', lesson.guidedLab.conceptIds], ['数据质量独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['null-user-id', 'null-paid-at', 'duplicate-order-id', 'test-order-included', 'zero-or-null-amount', 'boundary-cross-day', '业务问题', 'SQL', '预期风险', '实际看到', '能证明', '不能证明', 'IS NULL', 'O1018', 'TEST1', 'self_check.sql', 'answers.sql', '教学模拟']) {
    if (!serialized.includes(phrase)) issues.push(`W3D4 数据质量检查台缺少必测路径、动作或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产订单已经证明', '真实生产指标已经错误', 'W3D5 已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W3D4 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D4Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W3D4') issues.push(`证据适配器仅适配 W3D4，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w3d4-'))) issues.push('W3D4 证据适配器要求练习 ID 使用 w3d4- 前缀。')
  if (lesson.title !== '查询为何不可信') issues.push('W3D4 课程标题必须是“查询为何不可信”。')
  if (lesson.deliverable.title !== '数据质量检查表') issues.push('W3D4 今日成果必须是“数据质量检查表”。')
  if (lesson.nextLesson?.id !== 'W3D5') issues.push('W3D4 只能说明下一课 W3D5，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W3D4 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['data-quality-checklist.md', 'check_id', 'business_question', 'suspect_field', 'check_sql', 'expected_risk', 'observed_rows', 'risk_type', 'affected_query', 'can_prove', 'cannot_prove', 'recommended_fix', 'reviewer_note', 'self_check_result', 'next_sql_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D4 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['NULL', 'duplicate', 'test_data', 'time_boundary', 'amount_anomaly', '教学模拟', 'answers.sql', 'self_check.sql', 'W3D5', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D4 成果合同缺少质量类型、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产订单已经证明', '真实生产指标已经错误', 'W3D5 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W3D4 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D5Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'data-request-purpose', 'business-question-scope', 'field-source-assumption', 'filter-rule-contract',
    'time-window-contract', 'exclusion-rule-contract', 'expected-output-shape', 'review-question-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W3D5') issues.push(`实验仅适配 W3D5，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['取数需求六条确认引导实验', lesson.guidedLab.conceptIds], ['取数需求独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['scope-missing', 'field-source-missing', 'filter-rule-missing', 'time-window-ambiguous', 'quality-exclusion-missing', 'qualified-data-request', 'business_question', 'base_table', 'required_fields', 'filter_rules', 'time_window', 'quality_exclusions', 'expected_output', 'review_questions', '能证明', '不能证明', '教学模拟']) {
    if (!serialized.includes(phrase)) issues.push(`W3D5 取数需求确认台缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产订单已经证明', 'W3D6 已经完成', '指标已经正确']) {
    if (serialized.includes(forbidden)) issues.push(`W3D5 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D5Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W3D5') issues.push(`证据适配器仅适配 W3D5，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w3d5-'))) issues.push('W3D5 证据适配器要求练习 ID 使用 w3d5- 前缀。')
  if (lesson.title !== '向数据研发确认口径') issues.push('W3D5 课程标题必须是“向数据研发确认口径”。')
  if (lesson.deliverable.title !== '取数需求单') issues.push('W3D5 今日成果必须是“取数需求单”。')
  if (lesson.nextLesson?.id !== 'W3D6') issues.push('W3D5 只能说明下一课 W3D6，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W3D5 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['data-request.md', 'request_id', 'business_question', 'decision_context', 'base_table', 'required_fields', 'filter_rules', 'time_window', 'status_scope', 'quality_exclusions', 'expected_output', 'sample_sql_or_pseudocode', 'review_questions', 'can_prove', 'cannot_prove', 'next_sql_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D5 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['orders', 'status', 'paid', 'channel', 'app', 'paid_at >=', 'paid_at <', 'TEST1', 'O1018', 'NULL', '教学模拟', 'W3D6', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D5 成果合同缺少口径、质量风险、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产订单已经证明', '指标已经正确', 'W3D6 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W3D5 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D6Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'business-query-set', 'query-contract-reuse', 'row-level-answer', 'quality-flagged-answer',
    'sql-file-organization', 'answer-log-boundary', 'stakeholder-handoff-note', 'weekly-sql-review',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W3D6') issues.push(`实验仅适配 W3D6，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['业务查询十二道引导实验', lesson.guidedLab.conceptIds], ['业务查询独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of [
    'BQ01', 'BQ02', 'BQ03', 'BQ04', 'BQ05', 'BQ06', 'BQ07', 'BQ08', 'BQ09', 'BQ10', 'BQ11', 'BQ12',
    'bq01-paid-app-orders', 'bq12-review-ready-app-paid',
    'business_question', 'SQL', 'expected_rows', 'observed_result', 'quality_flags', 'can_prove', 'cannot_prove',
    'handoff_note', 'next_review_question', 'TEST1', 'O1018', 'NULL', '0 元', '教学模拟', 'W4D1',
  ]) {
    if (!serialized.includes(phrase)) issues.push(`W3D6 业务查询练习台缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产订单已经证明', '指标已经正确', 'W4D1 已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W3D6 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW3D6Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W3D6') issues.push(`证据适配器仅适配 W3D6，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w3d6-'))) issues.push('W3D6 证据适配器要求练习 ID 使用 w3d6- 前缀。')
  if (lesson.title !== '回答真实业务问题') issues.push('W3D6 课程标题必须是“回答真实业务问题”。')
  if (lesson.deliverable.title !== '12 道业务查询集') issues.push('W3D6 今日成果必须是“12 道业务查询集”。')
  if (lesson.nextLesson?.id !== 'W4D1') issues.push('W3D6 只能说明下一课 W4D1，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W3D6 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['business-query-set.sql', 'business-query-log.md', 'query_id', 'business_question', 'request_ref', 'base_table', 'sql_text', 'expected_rows', 'observed_result', 'quality_flags', 'can_prove', 'cannot_prove', 'handoff_note', 'next_review_question']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D6 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['BQ01', 'BQ12', 'orders', 'status', 'paid', 'channel', 'app', 'paid_at >=', 'paid_at <', 'TEST1', 'O1018', 'NULL', '0 元', '教学模拟', 'W4D1', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W3D6 成果合同缺少查询、质量风险、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产订单已经证明', '指标已经正确', 'W4D1 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W3D6 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D1Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'metric-decision-purpose', 'metric-signal', 'metric-numerator', 'metric-denominator',
    'metric-grain', 'metric-time-window', 'metric-exclusion-rule', 'metric-contract-table',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W4D1') issues.push(`实验仅适配 W4D1，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['指标口径六路径引导实验', lesson.guidedLab.conceptIds], ['指标口径独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of [
    'purpose-missing', 'denominator-missing', 'grain-ambiguous', 'time-window-ambiguous', 'exclusion-missing', 'qualified-metric-contract',
    'decision_purpose', 'signal', 'numerator', 'denominator', 'grain', 'time_window', 'exclusion_rules', 'quality_risks',
    'TEST1', 'O1018', 'NULL', 'O1014', '教学模拟', 'W4D2', '不能证明',
  ]) {
    if (!serialized.includes(phrase)) issues.push(`W4D1 指标口径观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产指标已经证明', '指标已经正确', 'W4D2 已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W4D1 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D1Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W4D1') issues.push(`证据适配器仅适配 W4D1，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w4d1-'))) issues.push('W4D1 证据适配器要求练习 ID 使用 w4d1- 前缀。')
  if (lesson.title !== '指标不是一个数字') issues.push('W4D1 课程标题必须是“指标不是一个数字”。')
  if (lesson.deliverable.title !== '指标口径表') issues.push('W4D1 今日成果必须是“指标口径表”。')
  if (lesson.nextLesson?.id !== 'W4D2') issues.push('W4D1 只能说明下一课 W4D2，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W4D1 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['metric-contract-table.md', 'metric_id', 'decision_purpose', 'signal', 'numerator', 'denominator', 'grain', 'time_window', 'exclusion_rules', 'quality_risks', 'source_query_ref', 'can_prove', 'cannot_prove', 'next_sql_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D1 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['app_paid_order_count', 'app_payment_conversion_rate', 'W3D6', 'BQ12', 'TEST1', 'O1018', 'NULL', 'O1014', '教学模拟', 'W4D2', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D1 成果合同缺少指标样例、风险、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产指标已经证明', '指标已经正确', 'W4D2 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W4D1 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'aggregation-input-set', 'count-aggregate', 'distinct-aggregate',
    'sum-aggregate', 'avg-aggregate', 'group-by-bucket', 'having-group-filter', 'aggregation-logic-map',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W4D2') issues.push(`实验仅适配 W4D2，实际课程为 ${lesson.id}。`)
  const guidedMissing = required.filter((id) => !new Set(lesson.guidedLab.conceptIds).has(id))
  if (guidedMissing.length) issues.push(`聚合路径引导实验缺少概念：${guidedMissing.join('、')}。`)
  const independentRequired = ['aggregation-input-set', 'distinct-aggregate', 'group-by-bucket', 'having-group-filter', 'aggregation-logic-map']
  const independentMissing = independentRequired.filter((id) => !new Set(lesson.independentLab.conceptIds).has(id))
  if (independentMissing.length) issues.push(`聚合独立变式缺少概念：${independentMissing.join('、')}。`)
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of [
    'exposed-users-count', 'same-day-payment-rate', 'rolling-24h-window', 'unique-paid-orders', 'average-vs-median', 'group-having-gate',
    'aggregation_id', 'metric_ref', 'input_rows', 'where_rule', 'aggregate_function', 'distinct_key', 'group_key', 'having_rule',
    'result_value', 'edge_case', 'COUNT', 'DISTINCT', 'SUM', 'AVG', 'GROUP BY', 'HAVING', 'U03', 'O05', 'TEST', 'O06', '教学模拟', '不能证明',
  ]) {
    if (!serialized.includes(phrase)) issues.push(`W4D2 聚合观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['真实生产指标已经正确', '真实生产结果已经证明', 'JOIN 已经完成', 'W4D3 已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W4D2 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W4D2') issues.push(`证据适配器仅适配 W4D2，实际课程为 ${lesson.id}.`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w4d2-'))) issues.push('W4D2 证据适配器要求练习 ID 使用 w4d2- 前缀。')
  if (lesson.title !== '聚合与分组入门') issues.push('W4D2 课程标题必须是“聚合与分组入门”。')
  if (lesson.deliverable.title !== '聚合逻辑图') issues.push('W4D2 今日成果必须是“聚合逻辑图”。')
  if (lesson.nextLesson?.id !== 'W4D3') issues.push('W4D2 只能说明下一课 W4D3，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W4D2 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['aggregation-logic.md', 'aggregation_id', 'metric_ref', 'business_question', 'input_rows', 'where_rule', 'aggregate_function', 'distinct_key', 'group_key', 'having_rule', 'result_value', 'edge_case', 'can_prove', 'cannot_prove', 'next_sql_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D2 成果合同缺少字段或文件名：${phrase}.`)
  }
  for (const phrase of ['W3D6', 'W4D1', 'COUNT', 'DISTINCT', 'SUM', 'AVG', 'GROUP BY', 'HAVING', 'U03', 'O05', 'O06', 'TEST', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D2 成果合同缺少聚合路径、边界或交接：${phrase}.`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JOIN 已经完成', 'GROUP BY 已经完成', '聚合结果正确', '真实生产指标已经证明', '指标已经正确', 'W4D3 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W4D2 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D3Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'metric-sql-base-cte', 'active-user-sql', 'same-day-conversion-sql', 'rolling-window-conversion-sql',
    'unique-paid-order-sql', 'aov-sql', 'median-outlier-guard-sql', 'metric-calculation-note',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W4D3') issues.push(`实验仅适配 W4D3，实际课程为 ${lesson.id}。`)
  const guidedMissing = required.filter((id) => !new Set(lesson.guidedLab.conceptIds).has(id))
  if (guidedMissing.length) issues.push(`指标计算引导实验缺少概念：${guidedMissing.join('、')}。`)
  const independentRequired = ['metric-sql-base-cte', 'rolling-window-conversion-sql', 'same-day-conversion-sql', 'metric-calculation-note']
  const independentMissing = independentRequired.filter((id) => !new Set(lesson.independentLab.conceptIds).has(id))
  if (independentMissing.length) issues.push(`指标计算独立变式缺少概念：${independentMissing.join('、')}。`)
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of [
    'base-events-cte', 'active-users', 'same-day-conversion', 'rolling-24h-conversion', 'unique-paid-orders', 'aov-and-guards',
    'metric_name', 'metric_ref', 'aggregation_ref', 'base_cte', 'sql_snippet', 'denominator', 'numerator', 'distinct_key', 'time_window',
    'result_value', 'sample_check', 'can_prove', 'cannot_prove', 'next_review_task',
    'active_users', 'exposure_to_pay', 'checkout_to_pay_24h', 'unique_paid_orders', 'aov_amount', 'median_amount',
    'TEST', 'U03', 'O05', 'O06', '教学模拟', '不能证明', 'W4D4',
  ]) {
    if (!serialized.includes(phrase)) issues.push(`W4D3 指标计算观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['真实生产指标已经证明', '真实生产指标已经正确', 'JOIN 已经完成', '看板已经可发布', 'W4D4 已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W4D3 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D3Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W4D3') issues.push(`证据适配器仅适配 W4D3，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w4d3-'))) issues.push('W4D3 证据适配器要求练习 ID 使用 w4d3- 前缀。')
  if (lesson.title !== '活跃、转化与客单价') issues.push('W4D3 课程标题必须是“活跃、转化与客单价”。')
  if (lesson.deliverable.title !== '指标计算 SQL') issues.push('W4D3 今日成果必须是“指标计算 SQL”。')
  if (lesson.nextLesson?.id !== 'W4D4') issues.push('W4D3 只能说明下一课 W4D4，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W4D3 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['metric-calculation.md', 'metric_name', 'metric_ref', 'aggregation_ref', 'business_question', 'base_cte', 'sql_snippet', 'denominator', 'numerator', 'distinct_key', 'time_window', 'result_value', 'sample_check', 'can_prove', 'cannot_prove', 'next_review_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D3 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['active_users', 'exposure_to_pay', 'checkout_to_pay_24h', 'unique_paid_orders', 'aov_amount', 'median_amount', 'TEST', 'U03', 'O05', 'O06', '教学模拟', 'W4D4', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D3 成果合同缺少指标结果、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['真实生产指标已经证明', '真实生产指标已经正确', 'JOIN 已经完成', '看板已经可发布', 'W4D4 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W4D3 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D4Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'rise-claim-audit', 'denominator-shift-trap', 'survivorship-bias-trap', 'outlier-average-trap',
    'composition-mix-shift', 'distribution-guard-check', 'misleading-rise-case-table', 'metric-rise-decision-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W4D4') issues.push(`实验仅适配 W4D4，实际课程为 ${lesson.id}。`)
  const guidedMissing = required.filter((id) => !new Set(lesson.guidedLab.conceptIds).has(id))
  if (guidedMissing.length) issues.push(`上涨审查引导实验缺少概念：${guidedMissing.join('、')}。`)
  const independentRequired = ['rise-claim-audit', 'outlier-average-trap', 'distribution-guard-check', 'metric-rise-decision-boundary']
  const independentMissing = independentRequired.filter((id) => !new Set(lesson.independentLab.conceptIds).has(id))
  if (independentMissing.length) issues.push(`上涨审查独立变式缺少概念：${independentMissing.join('、')}。`)
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of [
    'denominator_shift', 'survivorship_bias', 'outlier_average', 'composition_mix', 'distribution_guard',
    'misleading-rise-review.md', 'case_id', 'metric_name', 'old_value', 'new_value', 'claimed_rise', 'risk_type',
    'denominator_check', 'survivor_check', 'outlier_check', 'guardrail_metric', 'sample_check', 'can_prove', 'cannot_prove',
    'next_review_task', 'exposed_users', 'checkout_users', 'aov_amount', 'median_amount', 'max_amount', 'O06', 'W4D5',
    '不能证明', '教学模拟',
  ]) {
    if (!serialized.includes(phrase)) issues.push(`W4D4 上涨审查观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['真实生产增长已经证明', '真实生产指标已经正确', 'JOIN 已经完成', '看板已经可发布', 'W4D4 已经完成']) {
    if (serialized.includes(forbidden)) issues.push(`W4D4 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW4D4Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W4D4') issues.push(`证据适配器仅适配 W4D4，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w4d4-'))) issues.push('W4D4 证据适配器要求练习 ID 使用 w4d4- 前缀。')
  if (lesson.title !== '三种上涨假象') issues.push('W4D4 课程标题必须是“三种上涨假象”。')
  if (lesson.deliverable.title !== '上涨误导案例分析') issues.push('W4D4 今日成果必须是“上涨误导案例分析”。')
  if (lesson.nextLesson?.id !== 'W4D5') issues.push('W4D4 只能说明下一课 W4D5，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W4D4 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['misleading-rise-review.md', 'case_id', 'metric_name', 'old_value', 'new_value', 'claimed_rise', 'risk_type', 'denominator_check', 'survivor_check', 'outlier_check', 'guardrail_metric', 'sample_check', 'can_prove', 'cannot_prove', 'next_review_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D4 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['denominator_shift', 'survivorship_bias', 'outlier_average', 'composition_mix', 'distribution_guard', 'exposed_users', 'checkout_users', 'aov_amount', 'median_amount', 'max_amount', 'O06', 'W4D5', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W4D4 成果合同缺少上涨审查路径、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['真实生产增长已经证明', '真实生产指标已经正确', 'JOIN 已经完成', '看板已经可发布', 'W4D4 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W4D4 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW5D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'join-key-matching',
    'join-preserve-rule',
    'inner-join-filter',
    'left-join-preserve-left',
    'right-join-preserve-right',
    'full-join-preserve-both',
    'join-grain-amplification',
    'anti-join-gap-audit',
    'join-audit-map',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W5D2') issues.push(`实验仅适配 W5D2，实际课程为 ${lesson.id}。`)
  const guidedMissing = required.filter((id) => !new Set(lesson.guidedLab.conceptIds).has(id))
  if (guidedMissing.length) issues.push(`JOIN 对照引导实验缺少概念：${guidedMissing.join('、')}。`)
  const independentRequired = ['join-preserve-rule', 'left-join-preserve-left', 'anti-join-gap-audit', 'join-audit-map']
  const independentMissing = independentRequired.filter((id) => !new Set(lesson.independentLab.conceptIds).has(id))
  if (independentMissing.length) issues.push(`JOIN 对账独立变式缺少概念：${independentMissing.join('、')}。`)
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram, deliverable: lesson.deliverable, memory: lesson.memory })
  for (const phrase of ['W5-JOIN对账', 'reconciliation.md', '440', '740', 'O05', 'I08', 'LEFT JOIN', 'FULL JOIN', '先聚合再连接', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W5D2 JOIN 对照观察器缺少必测路径或边界：${phrase}。`)
  }
  return issues
}

function validateW5D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W5D2') issues.push(`证据适配器仅适配 W5D2，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w5d2-'))) issues.push('W5D2 证据适配器要求练习 ID 使用 w5d2- 前缀。')
  if (lesson.title !== '四种 JOIN 保留规则') issues.push('W5D2 课程标题必须是“四种 JOIN 保留规则”。')
  if (lesson.deliverable.title !== 'JOIN 对账记录') issues.push('W5D2 今日成果必须是“JOIN 对账记录”。')
  if (lesson.nextLesson?.id !== 'W5D3') issues.push('W5D2 只能说明下一课 W5D3，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W5D2 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['join_case_id', 'left_table', 'right_table', 'join_type', 'preserve_rule', 'join_key', 'rows_before', 'rows_after', 'unique_keys', 'unmatched_keys', 'amount_gap', 'can_prove', 'cannot_prove', 'next_sql_task']) {
    if (!deliverable.includes(phrase)) issues.push(`W5D2 成果合同缺少字段：${phrase}。`)
  }
  for (const phrase of ['W5-JOIN对账', 'reconciliation.md', 'JOIN 对照图', '正确 GMV', '错误 GMV', 'O05', 'I08', '先聚合再连接', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W5D2 成果合同缺少路径、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['真实生产 GMV 已经证明', 'JOIN 已经完成', '看板已经可发布', 'W5D3 已经完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W5D2 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW8D1Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'python-runtime-boundary',
    'statement-sequence',
    'input-output-boundary',
    'variable-assignment',
    'type-conversion-boundary',
    'branch-condition',
    'loop-iteration',
    'function-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W8D1') issues.push(`实验仅适配 W8D1，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['代码结构标注观察器', lesson.guidedLab.conceptIds], ['代码结构独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (label === '代码结构标注观察器') {
      const guidedRequired = required.slice(0, 6)
      const missingGuided = guidedRequired.filter((id) => !new Set(ids).has(id))
      if (missingGuided.length) issues.push(`${label}缺少概念：${missingGuided.join('、')}。`)
    } else if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['entry-input', 'assignment-conversion', 'branch-condition', 'loop-iteration', 'function-output', 'qualified-annotation', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W8D1 代码结构观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['JSON已完成', 'CSV已完成', '报错诊断已完成', '自动摘要已完成', '真实自动化已上线']) {
    if (serialized.includes(forbidden)) issues.push(`W8D1 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW8D1Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W8D1') issues.push(`证据适配器仅适配 W8D1，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w8d1-'))) issues.push('W8D1 证据适配器要求练习 ID 使用 w8d1- 前缀。')
  if (lesson.title !== '程序如何表达步骤') issues.push('W8D1 课程标题必须是“程序如何表达步骤”。')
  if (lesson.deliverable.title !== '代码结构标注') issues.push('W8D1 今日成果必须是“代码结构标注”。')
  if (lesson.nextLesson?.id !== 'W8D2') issues.push('W8D1 只能说明下一课 W8D2，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W8D1 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['code-structure-annotation.md', 'step_id', 'statement_or_block', 'role', 'input', 'output', 'boundary', 'can_prove', 'cannot_prove', 'next_step']) {
    if (!deliverable.includes(phrase)) issues.push(`W8D1 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['入口', '赋值', '类型转换', '条件分支', '循环', '函数', '教学模拟', 'W8D2', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W8D1 成果合同缺少结构路径、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JSON已完成', 'CSV已完成', '报错诊断已完成', '自动摘要已完成', '真实自动化已上线']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W8D1 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW8D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'script-input-contract',
    'raw-value-capture',
    'intermediate-state-flow',
    'transformation-step',
    'decision-path',
    'output-contract',
    'flow-trace',
    'execution-flow-diagram',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W8D2') issues.push(`实验仅适配 W8D2，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['输入到输出流程图观察器', lesson.guidedLab.conceptIds], ['输入到输出独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['raw-input', 'state-flow', 'transform-step', 'decision-path', 'output-target', 'qualified-flow-map', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W8D2 输入到输出观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['JSON已完成', 'CSV已完成', '报错诊断已完成', '文件批处理已完成', '真实业务已证明']) {
    if (serialized.includes(forbidden)) issues.push(`W8D2 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW8D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W8D2') issues.push(`证据适配器仅适配 W8D2，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w8d2-'))) issues.push('W8D2 证据适配器要求练习 ID 使用 w8d2- 前缀。')
  if (lesson.title !== '从输入到输出') issues.push('W8D2 课程标题必须是“从输入到输出”。')
  if (lesson.deliverable.title !== '执行流程图') issues.push('W8D2 今日成果必须是“执行流程图”。')
  if (lesson.nextLesson?.id !== 'W8D3') issues.push('W8D2 只能说明下一课 W8D3，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W8D2 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['execution-flow-diagram.md', 'flow_id', 'input_source', 'raw_value', 'state_variable', 'transform_step', 'decision_path', 'output_target', 'can_prove', 'cannot_prove', 'next_step']) {
    if (!deliverable.includes(phrase)) issues.push(`W8D2 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['输入契约', '原始值', '变量接力', '转换步骤', '判断路径', '输出契约', '教学模拟', 'W8D3', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W8D2 成果合同缺少流程路径、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['JSON已完成', 'CSV已完成', '报错诊断已完成', '文件批处理已完成', '真实业务已证明']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W8D2 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW8D6Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'summary-input-contract',
    'source-record-normalization',
    'metric-snapshot-assembly',
    'text-template-assembly',
    'repeatable-run-command',
    'evidence-limit-boundary',
    'fallback-on-schema-mismatch',
    'daily-summary-script',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W8D6') issues.push(`实验仅适配 W8D6，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['自动摘要引导观察器', lesson.guidedLab.conceptIds], ['自动摘要独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['教学模拟', 'summary-input-contract', 'metric-snapshot-assembly', 'repeatable-run-command', 'evidence-limit-boundary', 'fallback-on-schema-mismatch', 'cannot_prove']) {
    if (!serialized.includes(phrase)) issues.push(`W8D6 自动摘要观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['真实生产已上线', '数据已经完全正确', '生产调度已经自动化']) {
    if (serialized.includes(forbidden)) issues.push(`W8D6 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW8D6Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W8D6') issues.push(`证据适配器仅适配 W8D6，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w8d6-'))) issues.push('W8D6 证据适配器要求练习 ID 使用 w8d6- 前缀。')
  if (lesson.title !== '生成每日业务摘要') issues.push('W8D6 课程标题必须是“生成每日业务摘要”。')
  if (lesson.deliverable.title !== '自动摘要脚本') issues.push('W8D6 今日成果必须是“自动摘要脚本”。')
  if (lesson.nextLesson?.id !== 'W9D1') issues.push('W8D6 只能说明下一课 W9D1，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W8D6 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['daily-summary-script.py', 'script_id', 'input_source', 'cleaning_rule', 'metric_snapshot', 'summary_template', 'output_target', 'run_command', 'run_log', 'evidence_limit', 'can_prove', 'cannot_prove', 'next_step']) {
    if (!deliverable.includes(phrase)) issues.push(`W8D6 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['教学模拟', 'summary-input-contract', 'source-record-normalization', 'repeatable-run-command', 'evidence-limit-boundary', 'W9D1', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W8D6 成果合同缺少流程路径、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['真实生产已经证明', '生产调度已经自动化', 'JSON已完成', 'CSV已完成']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W8D6 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW9D3Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'orders-data-contract',
    'data-quality-snapshot',
    'pandas-copy-and-coerce',
    'issue-flag-columns',
    'clean-vs-quarantine-split',
    'rule-impact-log',
    'reconciliation-check',
    'order-cleaning-script',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W9D3') issues.push(`实验仅适配 W9D3，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['订单清洗引导观察器', lesson.guidedLab.conceptIds], ['订单清洗独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration, diagram: lesson.diagram })
  for (const phrase of ['orders_dirty.csv', 'quality_rules', 'issue_flags', 'clean_output', 'quarantine_output', 'rule_log', 'reconciliation_summary', 'clean_orders.py', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W9D3 订单清洗观察器缺少必测路径、字段或边界：${phrase}。`)
  }
  for (const forbidden of ['真实生产已经正确', '生产数据已经完全正确', '规则无争议', '坏行已经删除']) {
    if (serialized.includes(forbidden)) issues.push(`W9D3 不得提前教授或越界声明：${forbidden}。`)
  }
  return issues
}

function validateW9D3Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W9D3') issues.push(`证据适配器仅适配 W9D3，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w9d3-'))) issues.push('W9D3 证据适配器要求练习 ID 使用 w9d3- 前缀。')
  if (lesson.title !== '清洗订单') issues.push('W9D3 课程标题必须是“清洗订单”。')
  if (lesson.deliverable.title !== '清洗脚本') issues.push('W9D3 今日成果必须是“清洗脚本”。')
  if (lesson.nextLesson?.id !== 'W9D4') issues.push('W9D3 只能说明下一课 W9D4，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W9D3 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['clean_orders.py', 'script_id', 'source_file', 'quality_rules', 'issue_flags', 'clean_output', 'quarantine_output', 'rule_log', 'reconciliation_summary', 'can_prove', 'cannot_prove', 'next_step']) {
    if (!deliverable.includes(phrase)) issues.push(`W9D3 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['orders_dirty.csv', 'orders_clean.csv', 'orders_quarantine.csv', 'quality_report.md', '教学模拟', 'W9D4', '不能证明']) {
    if (!deliverable.includes(phrase)) issues.push(`W9D3 成果合同缺少流程路径、边界或交接：${phrase}。`)
  }
  const safeDeliverable = [lesson.deliverable.goodExample, lesson.deliverable.standardTemplate, lesson.deliverable.checklist.join('\n')].join('\n')
  for (const forbidden of ['真实生产已经证明', '生产数据已经完全正确', '规则无争议', '坏行已经删除']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W9D3 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW11D1Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'ai-feature-system', 'ai-request-context', 'model-generation-boundary',
    'ai-capability-slots-overview', 'ai-policy-orchestration', 'ai-output-handoff', 'ai-observation-audit',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W11D1') issues.push(`实验仅适配 W11D1，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['AI 系统链引导观察器', lesson.guidedLab.conceptIds], ['AI 系统链独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['完整链', '上下文缺失', '能力不可用', '规则阻断', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W11D1 观察器缺少必测变式或边界：${phrase}。`)
  }
  return issues
}

function validateW11D1Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W11D1') issues.push(`证据适配器仅适配 W11D1，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w11d1-'))) issues.push('W11D1 证据适配器要求练习 ID 使用 w11d1- 前缀。')
  if (lesson.deliverable.title !== 'AI 系统链路说明') issues.push('W11D1 今日成果必须是“AI 系统链路说明”。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W11D1 复习排程必须覆盖六个阶段。')
  if (lesson.nextLesson?.id !== 'W11D2') issues.push('W11D1 只能说明下一课 W11D2，不得开放或替代其内容。')
  return issues
}

function validateW11D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'tool-action-boundary', 'tool-registry-schema', 'tool-call-proposal', 'tool-argument-validation',
    'tool-authorization', 'tool-human-confirmation', 'tool-execution-side-effect', 'tool-result-receipt',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W11D2') issues.push(`实验仅适配 W11D2，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['工具调用六路径引导实验', lesson.guidedLab.conceptIds], ['工具调用独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['工具未注册', '工具参数缺失', '工具权限拒绝', '缺少人工确认', '工具执行失败', '工具教学成功', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W11D2 工具调用观察器缺少必测变式或边界：${phrase}。`)
  }
  return issues
}

function validateW11D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W11D2') issues.push(`证据适配器仅适配 W11D2，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w11d2-'))) issues.push('W11D2 证据适配器要求练习 ID 使用 w11d2- 前缀。')
  if (lesson.deliverable.title !== 'AI 调用图') issues.push('W11D2 今日成果必须是“AI 调用图”。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W11D2 复习排程必须覆盖六个阶段。')
  if (lesson.nextLesson?.id !== 'W11D3') issues.push('W11D2 只能说明下一课 W11D3，不得开放或替代其内容。')
  return issues
}

function validateW11D3Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'ai-eval-target-slice', 'ai-eval-dimension-rubric', 'ai-eval-case-schema', 'ai-eval-behavior-oracle',
    'ai-eval-sample-strata', 'ai-eval-safety-cases', 'ai-eval-coverage-matrix', 'ai-eval-set-gate',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W11D3') issues.push(`实验仅适配 W11D3，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['最小评测集六路径引导实验', lesson.guidedLab.conceptIds], ['会议纪要助手独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['缺少 expected_action', '回答合理', '拒答类别为空', '重复输入', 'hard_gate=false', '20 条五类平衡', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W11D3 集合观察器缺少必测变式或边界：${phrase}。`)
  }
  return issues
}

function validateW11D3Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W11D3') issues.push(`证据适配器仅适配 W11D3，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w11d3-'))) issues.push('W11D3 证据适配器要求练习 ID 使用 w11d3- 前缀。')
  if (lesson.deliverable.title !== '20 条评测样本') issues.push('W11D3 今日成果必须是“20 条评测样本”。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W11D3 复习排程必须覆盖六个阶段。')
  if (lesson.nextLesson?.id !== 'W11D4') issues.push('W11D3 只能说明下一课 W11D4，不得开放或替代其内容。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['normal', 'boundary', 'adversarial', 'privacy', 'refusal', 'hard_gate', 'evidence_limit']) {
    if (!deliverable.includes(phrase)) issues.push(`W11D3 成果合同缺少字段或类别：${phrase}。`)
  }
  return issues
}

function validateW11D4Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'ai-failure-observed-output', 'ai-failure-knowledge-gap', 'ai-failure-retrieval-gap', 'ai-failure-source-conflict',
    'ai-failure-generation-overreach', 'ai-failure-tool-chain', 'ai-failure-expression-certainty', 'ai-failure-classification-table',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W11D4') issues.push(`实验仅适配 W11D4，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['失败分类六路径引导实验', lesson.guidedLab.conceptIds], ['会议纪要助手独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['知识缺失', '召回缺口', '资料冲突', '生成过度推断', '工具链失败', '表达过度确定', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W11D4 失败分类观察器缺少必测变式或边界：${phrase}。`)
  }
  return issues
}

function validateW11D4Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W11D4') issues.push(`证据适配器仅适配 W11D4，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w11d4-'))) issues.push('W11D4 证据适配器要求练习 ID 使用 w11d4- 前缀。')
  if (lesson.deliverable.title !== '失败分类表') issues.push('W11D4 今日成果必须是“失败分类表”。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W11D4 复习排程必须覆盖六个阶段。')
  if (lesson.nextLesson?.id !== 'W11D5') issues.push('W11D4 只能说明下一课 W11D5，不得开放或替代其内容。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['knowledge_gap', 'retrieval_gap', 'source_conflict', 'generation_overreach', 'tool_chain', 'expression_overcertainty', 'first_failed_stage', 'evidence_limit']) {
    if (!deliverable.includes(phrase)) issues.push(`W11D4 成果合同缺少字段或类别：${phrase}。`)
  }
  return issues
}

function validateW11D5Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'ai-risk-token-cost', 'ai-risk-unit-budget', 'ai-risk-latency-budget', 'ai-risk-critical-path',
    'ai-risk-safety-boundary', 'ai-risk-safe-completion', 'ai-risk-degradation-fallback',
    'ai-risk-human-escalation', 'ai-risk-decision-table',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W11D5') issues.push(`实验仅适配 W11D5，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['成本延迟安全六路径引导实验', lesson.guidedLab.conceptIds], ['会议纪要助手风险建议独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['token_budget_exceeded', 'tool_retry_cost', 'latency_budget_breach', 'timeout_degradation', 'safety_policy_block', 'human_escalation', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W11D5 风险建议观察器缺少必测变式或边界：${phrase}。`)
  }
  return issues
}

function validateW11D5Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W11D5') issues.push(`证据适配器仅适配 W11D5，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w11d5-'))) issues.push('W11D5 证据适配器要求练习 ID 使用 w11d5- 前缀。')
  if (lesson.deliverable.title !== '成本延迟安全风险建议表') issues.push('W11D5 今日成果必须是“成本延迟安全风险建议表”。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W11D5 复习排程必须覆盖六个阶段。')
  if (lesson.nextLesson?.id !== 'W11D6') issues.push('W11D5 只能说明下一课 W11D6，不得创建或替代其内容。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['cost_driver', 'latency_driver', 'safety_risk', 'decision', 'product_action', 'evidence_limit', 'token_budget_exceeded', 'latency_budget_breach', 'safety_policy_block', 'human_escalation']) {
    if (!deliverable.includes(phrase)) issues.push(`W11D5 成果合同缺少字段或类别：${phrase}。`)
  }
  return issues
}

function validateW11D6Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'ai-report-eval-scope', 'ai-report-target-version', 'ai-report-result-table', 'ai-report-gate-threshold',
    'ai-report-failure-synthesis', 'ai-report-risk-synthesis', 'ai-report-launch-decision', 'ai-report-evidence-boundary',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W11D6') issues.push(`实验仅适配 W11D6，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['综合评测报告六段引导实验', lesson.guidedLab.conceptIds], ['退款 AI 客服综合评测独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['scope_version', 'result_summary', 'failure_analysis', 'risk_recommendation', 'launch_decision', 'follow_up_plan', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W11D6 综合报告观察器缺少必测段落或边界：${phrase}。`)
  }
  return issues
}

function validateW11D6Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W11D6') issues.push(`证据适配器仅适配 W11D6，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w11d6-'))) issues.push('W11D6 证据适配器要求练习 ID 使用 w11d6- 前缀。')
  if (lesson.deliverable.title !== 'AI 客服综合评测报告') issues.push('W11D6 今日成果必须是“AI 客服综合评测报告”。')
  if (lesson.nextLesson?.id !== 'W12D1') issues.push('W11D6 只能说明下一课 W12D1，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W11D6 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['section_id', 'report_part', 'evidence_used', 'conclusion', 'recommendation', 'evidence_limit', 'scope', 'result_summary', 'failure_analysis', 'risk_recommendation', 'launch_decision', 'follow_up_plan']) {
    if (!deliverable.includes(phrase)) issues.push(`W11D6 成果合同缺少字段或段落：${phrase}。`)
  }
  return issues
}

function validateW12D1Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'portfolio-problem-statement', 'portfolio-target-user', 'portfolio-stakeholder-outcome',
    'portfolio-evidence-inventory', 'portfolio-missing-evidence', 'portfolio-success-metric',
    'portfolio-scope-non-goals', 'portfolio-brief-decision',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W12D1') issues.push(`实验仅适配 W12D1，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['项目 Brief 六路径引导实验', lesson.guidedLab.conceptIds], ['内部知识库助手 Brief 独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['problem-too-broad', 'user-missing', 'evidence-missing', 'metric-not-measurable', 'scope-creep', 'qualified-brief', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W12D1 项目 Brief 观察器缺少必测路径或边界：${phrase}。`)
  }
  return issues
}

function validateW12D1Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W12D1') issues.push(`证据适配器仅适配 W12D1，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w12d1-'))) issues.push('W12D1 证据适配器要求练习 ID 使用 w12d1- 前缀。')
  if (lesson.deliverable.title !== '项目 Brief') issues.push('W12D1 今日成果必须是“项目 Brief”。')
  if (lesson.nextLesson?.id !== 'W12D2') issues.push('W12D1 只能说明下一课 W12D2，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W12D1 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['project_title', 'user_problem', 'target_user', 'stakeholders', 'evidence_used', 'missing_evidence', 'success_metric', 'scope', 'non_goals', 'assumptions', 'largest_unknown', 'next_step', 'evidence_limit', 'project-brief.md']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D1 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const forbidden of ['系统与数据方案已完成', '验证日志已完成', '风险登记册已完成', '作品集已完成', '答辩已通过', '真实业务价值已证明']) {
    if (deliverable.includes(forbidden)) issues.push(`W12D1 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW12D2Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'portfolio-system-boundary', 'portfolio-user-journey-touchpoint', 'portfolio-data-entity',
    'portfolio-data-source-owner', 'portfolio-io-contract', 'portfolio-state-lifecycle',
    'portfolio-integration-dependency', 'portfolio-system-data-decision',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W12D2') issues.push(`实验仅适配 W12D2，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['系统与数据方案六路径引导实验', lesson.guidedLab.conceptIds], ['内部知识库助手系统与数据方案独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['boundary-missing', 'entity-missing', 'source-unknown', 'contract-missing', 'state-missing', 'qualified-plan', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W12D2 系统与数据方案观察器缺少必测路径或边界：${phrase}。`)
  }
  for (const conceptId of required) {
    if (!serialized.includes(conceptId)) issues.push(`W12D2 实验未覆盖首次教学概念：${conceptId}。`)
  }
  return issues
}

function validateW12D2Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W12D2') issues.push(`证据适配器仅适配 W12D2，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w12d2-'))) issues.push('W12D2 证据适配器要求练习 ID 使用 w12d2- 前缀。')
  if (lesson.deliverable.title !== '系统与数据方案') issues.push('W12D2 今日成果必须是“系统与数据方案”。')
  if (lesson.nextLesson?.id !== 'W12D3') issues.push('W12D2 只能说明下一课 W12D3，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W12D2 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['brief_ref', 'system_goal', 'system_boundary', 'user_touchpoints', 'data_entities', 'data_sources', 'input_output_contracts', 'state_lifecycle', 'dependencies', 'privacy_access_boundary', 'validation_questions', 'non_goals', 'evidence_limit', 'system-data-plan.md']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D2 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['FailureSample', 'ReviewRecord', 'ClassificationSuggestion', 'owner', 'required_inputs', 'outputs', 'error_cases', 'imported', 'classified', 'exported', 'W12D3']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D2 成果合同缺少可审核示例或下一步：${phrase}。`)
  }
  for (const forbidden of ['验证日志已完成', '风险登记册已完成', '评审纪要已完成', '作品集已完成', '答辩已通过', '真实系统已开发', '真实数据已接入', '验证已通过']) {
    if (deliverable.includes(forbidden)) issues.push(`W12D2 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW12D3Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'portfolio-largest-unknown', 'portfolio-validation-question', 'portfolio-runnable-check',
    'portfolio-test-fixture', 'portfolio-pass-fail-criterion', 'portfolio-run-log',
    'portfolio-observation-boundary', 'portfolio-validation-decision',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W12D3') issues.push(`实验仅适配 W12D3，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['可运行验证日志六路径引导实验', lesson.guidedLab.conceptIds], ['知识库权限未知独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['unknown-too-broad', 'question-missing', 'fixture-missing', 'criterion-missing', 'log-incomplete', 'qualified-validation', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W12D3 可运行验证日志观察器缺少必测路径或边界：${phrase}。`)
  }
  for (const conceptId of required) {
    if (!serialized.includes(conceptId)) issues.push(`W12D3 实验未覆盖首次教学概念：${conceptId}。`)
  }
  return issues
}

function validateW12D3Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W12D3') issues.push(`证据适配器仅适配 W12D3，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w12d3-'))) issues.push('W12D3 证据适配器要求练习 ID 使用 w12d3- 前缀。')
  if (lesson.title !== '最大未知的可运行验证日志') issues.push('W12D3 课程标题必须是“最大未知的可运行验证日志”。')
  if (lesson.deliverable.title !== '可运行验证日志') issues.push('W12D3 今日成果必须是“可运行验证日志”。')
  if (lesson.nextLesson?.id !== 'W12D4') issues.push('W12D3 只能说明下一课 W12D4，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W12D3 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['validation_id', 'brief_ref', 'unknown_to_test', 'validation_question', 'fixture_used', 'run_steps', 'expected_result', 'observed_result', 'pass_fail', 'evidence_collected', 'decision', 'cannot_prove', 'next_action', 'validation-log.csv']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D3 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['W12D1', 'W12D2', '教学模拟', 'FailureSample', 'human_review_required', 'evidence_limit', 'pass/fail/inconclusive', 'W12D4']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D3 成果合同缺少可审核示例或下一步：${phrase}。`)
  }
  for (const forbidden of ['风险登记册已完成', '评审纪要已完成', '作品集已完成', '答辩已通过', '真实系统已上线', '真实数据已接入', '生产稳定性已证明', '真实业务价值已证明', '风险已关闭']) {
    if (deliverable.includes(forbidden)) issues.push(`W12D3 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW12D4Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'portfolio-risk-source', 'portfolio-risk-statement', 'portfolio-risk-probability', 'portfolio-risk-impact',
    'portfolio-risk-prevention', 'portfolio-risk-monitoring', 'portfolio-risk-trigger-fallback', 'portfolio-risk-owner',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W12D4') issues.push(`实验仅适配 W12D4，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['风险登记册六路径引导实验', lesson.guidedLab.conceptIds], ['知识库权限风险登记独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['risk-too-vague', 'probability-missing', 'impact-missing', 'prevention-missing', 'trigger-fallback-missing', 'qualified-risk-register', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W12D4 风险登记册观察器缺少必测路径或边界：${phrase}。`)
  }
  for (const conceptId of required) {
    if (!serialized.includes(conceptId)) issues.push(`W12D4 实验未覆盖首次教学概念：${conceptId}。`)
  }
  return issues
}

function validateW12D4Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W12D4') issues.push(`证据适配器仅适配 W12D4，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w12d4-'))) issues.push('W12D4 证据适配器要求练习 ID 使用 w12d4- 前缀。')
  if (lesson.title !== '风险登记册编写') issues.push('W12D4 课程标题必须是“风险登记册编写”。')
  if (lesson.deliverable.title !== '风险登记册') issues.push('W12D4 今日成果必须是“风险登记册”。')
  if (lesson.nextLesson?.id !== 'W12D5') issues.push('W12D4 只能说明下一课 W12D5，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W12D4 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['risk_id', 'evidence_ref', 'risk_statement', 'probability', 'impact', 'prevention_action', 'monitoring_signal', 'trigger_condition', 'fallback_plan', 'owner', 'review_cadence', 'status', 'evidence_limit', 'risk-register.csv']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D4 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['W12D3', 'validation-log.csv', 'cannot_prove', '教学模拟', 'pending_review', 'W12D5']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D4 成果合同缺少可审核示例或下一步：${phrase}。`)
  }
  for (const forbidden of ['评审纪要已完成', '作品集已完成', '答辩已通过', '真实概率已证明', '真实影响已证明', 'owner已承诺', '评审已通过', '风险已关闭']) {
    if (deliverable.includes(forbidden)) issues.push(`W12D4 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW12D5Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'portfolio-review-role', 'portfolio-review-question', 'portfolio-review-evidence-response',
    'portfolio-review-gap', 'portfolio-review-decision', 'portfolio-review-revision-action',
    'portfolio-review-owner-confirmation', 'portfolio-review-change-log',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W12D5') issues.push(`实验仅适配 W12D5，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['评审纪要六路径引导实验', lesson.guidedLab.conceptIds], ['跨职能评审修订独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['role-missing', 'question-vague', 'evidence-missing', 'decision-missing', 'revision-owner-missing', 'qualified-review-notes', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W12D5 评审纪要观察器缺少必测路径或边界：${phrase}。`)
  }
  for (const conceptId of required) {
    if (!serialized.includes(conceptId)) issues.push(`W12D5 实验未覆盖首次教学概念：${conceptId}。`)
  }
  return issues
}

function validateW12D5Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W12D5') issues.push(`证据适配器仅适配 W12D5，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w12d5-'))) issues.push('W12D5 证据适配器要求练习 ID 使用 w12d5- 前缀。')
  if (lesson.title !== '跨职能评审与修订') issues.push('W12D5 课程标题必须是“跨职能评审与修订”。')
  if (lesson.deliverable.title !== '评审纪要') issues.push('W12D5 今日成果必须是“评审纪要”。')
  if (lesson.nextLesson?.id !== 'W12D6') issues.push('W12D5 只能说明下一课 W12D6，不得创建或替代其内容。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W12D5 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['review_id', 'artifact_ref', 'review_role', 'question', 'evidence_cited', 'answer_summary', 'gap_or_risk', 'decision', 'revision_action', 'owner', 'due_date', 'status', 'evidence_limit', 'review-notes.md']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D5 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['W12D1', 'W12D2', 'W12D3', 'W12D4', 'risk-register.csv', '教学模拟', 'revise', 'pending_owner_confirmation', 'W12D6']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D5 成果合同缺少可审核示例或下一步：${phrase}。`)
  }
  for (const forbidden of ['作品集已完成', '答辩已通过', '真实跨职能已批准', '真实评审已通过', 'owner已承诺', '最终作品集完成', '上线已批准']) {
    if (deliverable.includes(forbidden)) issues.push(`W12D5 不得越界声明：${forbidden}。`)
  }
  return issues
}

function validateW12D6Experiment(lesson: DailyCourse): readonly string[] {
  const required = [
    'portfolio-artifact-index', 'portfolio-evidence-thread', 'portfolio-storyline',
    'portfolio-ten-minute-pitch', 'portfolio-demo-boundary', 'portfolio-reviewer-qna',
    'portfolio-retrospective-insight', 'portfolio-redaction-evidence-limit',
  ]
  const issues: string[] = []
  if (lesson.id !== 'W12D6') issues.push(`实验仅适配 W12D6，实际课程为 ${lesson.id}。`)
  for (const [label, ids] of [['作品集装配六路径引导实验', lesson.guidedLab.conceptIds], ['作品集答辩独立变式', lesson.independentLab.conceptIds]] as const) {
    const missing = required.filter((id) => !new Set(ids).has(id))
    if (missing.length) issues.push(`${label}缺少概念：${missing.join('、')}。`)
  }
  const serialized = JSON.stringify({ guidedLab: lesson.guidedLab, independentLab: lesson.independentLab, demonstration: lesson.demonstration })
  for (const phrase of ['artifact-missing', 'evidence-thread-broken', 'pitch-too-long', 'demo-boundary-missing', 'qna-unprepared', 'qualified-portfolio-package', '教学模拟', '不能证明']) {
    if (!serialized.includes(phrase)) issues.push(`W12D6 作品集装配观察器缺少必测路径或边界：${phrase}。`)
  }
  for (const conceptId of required) {
    if (!serialized.includes(conceptId)) issues.push(`W12D6 实验未覆盖首次教学概念：${conceptId}。`)
  }
  return issues
}

function validateW12D6Evidence(lesson: DailyCourse): readonly string[] {
  const issues: string[] = []
  if (lesson.id !== 'W12D6') issues.push(`证据适配器仅适配 W12D6，实际课程为 ${lesson.id}。`)
  if (!lesson.exercises.every((exercise) => exercise.id.startsWith('w12d6-'))) issues.push('W12D6 证据适配器要求练习 ID 使用 w12d6- 前缀。')
  if (lesson.title !== '作品集装配、10 分钟答辩和复盘') issues.push('W12D6 课程标题必须是“作品集装配、10 分钟答辩和复盘”。')
  if (lesson.deliverable.title !== '完整作品集包') issues.push('W12D6 今日成果必须是“完整作品集包”。')
  if (lesson.nextLesson) issues.push('W12D6 是核心课程终点，不得声明 nextLesson。')
  if (lesson.memory.reviewStages.map((stage) => stage.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') issues.push('W12D6 复习排程必须覆盖六个阶段。')
  const deliverable = JSON.stringify(lesson.deliverable)
  for (const phrase of ['portfolio_id', 'artifact_index', 'problem_story', 'solution_summary', 'evidence_thread', 'risk_review_summary', 'revision_log', 'ten_minute_pitch', 'demo_boundary', 'reviewer_qna', 'retrospective_insight', 'redaction_boundary', 'evidence_limit', 'portfolio-checklist.md']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D6 成果合同缺少字段或文件名：${phrase}。`)
  }
  for (const phrase of ['W12D1', 'W12D2', 'W12D3', 'W12D4', 'W12D5', '教学模拟', '10 分钟', 'W13D1']) {
    if (!deliverable.includes(phrase)) issues.push(`W12D6 成果合同缺少可审核示例或终点边界：${phrase}。`)
  }
  const safeDeliverable = JSON.stringify({
    fields: lesson.deliverable.fields,
    revisionSteps: lesson.deliverable.revisionSteps,
    goodExample: lesson.deliverable.goodExample,
    standardTemplate: lesson.deliverable.standardTemplate,
    checklist: lesson.deliverable.checklist,
  })
  for (const forbidden of ['真实上线已完成', '真实业务价值已证明', '真实答辩已通过', '招聘成功', '录用已确定', 'W13D1 继续']) {
    if (safeDeliverable.includes(forbidden)) issues.push(`W12D6 不得越界声明：${forbidden}。`)
  }
  return issues
}

const w1d1Renderer = Object.freeze({
  kind: 'renderer',
  key: 'w1d1',
  dayId: 'W1D1',
  load: () => import('../views/W1D1Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w1d1ExperimentAdapter = Object.freeze({
  kind: 'experiment',
  key: 'frontend-dom-age-sandbox-v1',
  dayId: 'W1D1',
  validateLesson: validateW1D1Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w1d1EvidenceAdapter = Object.freeze({
  kind: 'evidence',
  key: 'w1d1-evidence-v2',
  dayId: 'W1D1',
  schemaVersion: 2,
  validateLesson: validateW1D1Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w1d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w1d2',
  dayId: 'W1D2',
  load: () => import('../views/W1D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w1d3Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w1d3',
  dayId: 'W1D3',
  load: () => import('../views/W1D3Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w1d4Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w1d4',
  dayId: 'W1D4',
  load: () => import('../views/W1D4Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w1d5Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w1d5',
  dayId: 'W1D5',
  load: () => import('../views/W1D5Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w3d1Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w3d1',
  dayId: 'W3D1',
  load: () => import('../views/W3D1Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w3d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w3d2',
  dayId: 'W3D2',
  load: () => import('../views/W3D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w3d3Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w3d3',
  dayId: 'W3D3',
  load: () => import('../views/W3D3Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w3d4Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w3d4',
  dayId: 'W3D4',
  load: () => import('../views/W3D4Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w3d5Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w3d5',
  dayId: 'W3D5',
  load: () => import('../views/W3D5Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w3d6Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w3d6',
  dayId: 'W3D6',
  load: () => import('../views/W3D6Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w4d1Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w4d1',
  dayId: 'W4D1',
  load: () => import('../views/W4D1Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w4d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w4d2',
  dayId: 'W4D2',
  load: () => import('../views/W4D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w11d1Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w11d1',
  dayId: 'W11D1',
  load: () => import('../views/W11D1Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w11d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w11d2',
  dayId: 'W11D2',
  load: () => import('../views/W11D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w11d3Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w11d3',
  dayId: 'W11D3',
  load: () => import('../views/W11D3Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w11d4Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w11d4',
  dayId: 'W11D4',
  load: () => import('../views/W11D4Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w11d5Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w11d5',
  dayId: 'W11D5',
  load: () => import('../views/W11D5Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w11d6Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w11d6',
  dayId: 'W11D6',
  load: () => import('../views/W11D6Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w12d1Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w12d1',
  dayId: 'W12D1',
  load: () => import('../views/W12D1Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w12d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w12d2',
  dayId: 'W12D2',
  load: () => import('../views/W12D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w12d3Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w12d3',
  dayId: 'W12D3',
  load: () => import('../views/W12D3Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w12d4Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w12d4',
  dayId: 'W12D4',
  load: () => import('../views/W12D4Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w12d5Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w12d5',
  dayId: 'W12D5',
  load: () => import('../views/W12D5Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w12d6Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w12d6',
  dayId: 'W12D6',
  load: () => import('../views/W12D6Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w1d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'url-dns-addressing-v1', dayId: 'W1D2', validateLesson: validateW1D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w1d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w1d2-evidence-v1', dayId: 'W1D2', schemaVersion: 2, validateLesson: validateW1D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w1d3ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'http-observation-day01-v2', dayId: 'W1D3', validateLesson: validateW1D3Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w1d3EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w1d3-evidence-v2', dayId: 'W1D3', schemaVersion: 2, validateLesson: validateW1D3Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w1d4ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'api-backend-persistence-day01-v1', dayId: 'W1D4', validateLesson: validateW1D4Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w1d4EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w1d4-evidence-v2', dayId: 'W1D4', schemaVersion: 2, validateLesson: validateW1D4Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w1d5ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'network-evidence-observer-day01-v1', dayId: 'W1D5', validateLesson: validateW1D5Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w1d5EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w1d5-evidence-v2', dayId: 'W1D5', schemaVersion: 2, validateLesson: validateW1D5Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w3d1ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'sqlite-environment-gate-observer-day01-v1', dayId: 'W3D1', validateLesson: validateW3D1Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w3d1EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w3d1-evidence-v2', dayId: 'W3D1', schemaVersion: 2, validateLesson: validateW3D1Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w3d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'select-execution-order-observer-day01-v1', dayId: 'W3D2', validateLesson: validateW3D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w3d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w3d2-evidence-v2', dayId: 'W3D2', schemaVersion: 2, validateLesson: validateW3D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w3d3ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'basic-sql-query-observer-day01-v1', dayId: 'W3D3', validateLesson: validateW3D3Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w3d3EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w3d3-evidence-v2', dayId: 'W3D3', schemaVersion: 2, validateLesson: validateW3D3Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w3d4ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'data-quality-check-observer-day01-v1', dayId: 'W3D4', validateLesson: validateW3D4Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w3d4EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w3d4-evidence-v2', dayId: 'W3D4', schemaVersion: 2, validateLesson: validateW3D4Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w3d5ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'data-request-contract-observer-day01-v1', dayId: 'W3D5', validateLesson: validateW3D5Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w3d5EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w3d5-evidence-v2', dayId: 'W3D5', schemaVersion: 2, validateLesson: validateW3D5Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w3d6ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'business-query-set-observer-day01-v1', dayId: 'W3D6', validateLesson: validateW3D6Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w3d6EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w3d6-evidence-v2', dayId: 'W3D6', schemaVersion: 2, validateLesson: validateW3D6Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w4d1ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'metric-contract-table-observer-day01-v1', dayId: 'W4D1', validateLesson: validateW4D1Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w4d1EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w4d1-evidence-v2', dayId: 'W4D1', schemaVersion: 2, validateLesson: validateW4D1Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w4d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'aggregation-logic-observer-day01-v1', dayId: 'W4D2', validateLesson: validateW4D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w4d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w4d2-evidence-v2', dayId: 'W4D2', schemaVersion: 2, validateLesson: validateW4D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w4d3Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w4d3',
  dayId: 'W4D3',
  load: () => import('../views/W4D3Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w4d3ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'metric-calculation-observer-day01-v1', dayId: 'W4D3', validateLesson: validateW4D3Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w4d3EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w4d3-evidence-v2', dayId: 'W4D3', schemaVersion: 2, validateLesson: validateW4D3Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w4d4Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w4d4',
  dayId: 'W4D4',
  load: () => import('../views/W4D4Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w4d4ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'misleading-rise-observer-day01-v1', dayId: 'W4D4', validateLesson: validateW4D4Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w4d4EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w4d4-evidence-v2', dayId: 'W4D4', schemaVersion: 2, validateLesson: validateW4D4Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w5d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w5d2',
  dayId: 'W5D2',
  load: () => import('../views/W5D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w5d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'join-preserve-observer-day01-v1', dayId: 'W5D2', validateLesson: validateW5D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w5d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w5d2-evidence-v2', dayId: 'W5D2', schemaVersion: 2, validateLesson: validateW5D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w8d1Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w8d1',
  dayId: 'W8D1',
  load: () => import('../views/W8D1Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w8d1ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'python-step-structure-observer-day01-v1', dayId: 'W8D1', validateLesson: validateW8D1Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w8d1EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w8d1-evidence-v2', dayId: 'W8D1', schemaVersion: 2, validateLesson: validateW8D1Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w8d2Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w8d2',
  dayId: 'W8D2',
  load: () => import('../views/W8D2Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w8d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'python-input-output-flow-observer-day01-v1', dayId: 'W8D2', validateLesson: validateW8D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w8d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w8d2-evidence-v2', dayId: 'W8D2', schemaVersion: 2, validateLesson: validateW8D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w8d6Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w8d6',
  dayId: 'W8D6',
  load: () => import('../views/W8D6Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w8d6ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'daily-summary-script-observer-day01-v1', dayId: 'W8D6', validateLesson: validateW8D6Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w8d6EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w8d6-evidence-v2', dayId: 'W8D6', schemaVersion: 2, validateLesson: validateW8D6Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w9d3Renderer = Object.freeze({
  kind: 'renderer',
  key: 'day01-framework-w9d3',
  dayId: 'W9D3',
  load: () => import('../views/W9D3Page.vue'),
} as const satisfies DailyCourseRendererImplementation)

const w9d3ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'order-cleaning-observer-day01-v1', dayId: 'W9D3', validateLesson: validateW9D3Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w9d3EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w9d3-evidence-v2', dayId: 'W9D3', schemaVersion: 2, validateLesson: validateW9D3Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w11d1ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'ai-system-chain-observer-day01-v1', dayId: 'W11D1', validateLesson: validateW11D1Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w11d1EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w11d1-evidence-v2', dayId: 'W11D1', schemaVersion: 2, validateLesson: validateW11D1Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w11d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'tool-call-gate-observer-day01-v2', dayId: 'W11D2', validateLesson: validateW11D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w11d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w11d2-evidence-v2', dayId: 'W11D2', schemaVersion: 2, validateLesson: validateW11D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w11d3ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'minimum-eval-set-gate-observer-day01-v1', dayId: 'W11D3', validateLesson: validateW11D3Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w11d3EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w11d3-evidence-v2', dayId: 'W11D3', schemaVersion: 2, validateLesson: validateW11D3Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w11d4ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'failure-classification-gate-observer-day01-v1', dayId: 'W11D4', validateLesson: validateW11D4Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w11d4EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w11d4-evidence-v2', dayId: 'W11D4', schemaVersion: 2, validateLesson: validateW11D4Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w11d5ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'cost-latency-safety-risk-observer-day01-v1', dayId: 'W11D5', validateLesson: validateW11D5Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w11d5EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w11d5-evidence-v2', dayId: 'W11D5', schemaVersion: 2, validateLesson: validateW11D5Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w11d6ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'ai-service-eval-report-observer-day01-v1', dayId: 'W11D6', validateLesson: validateW11D6Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w11d6EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w11d6-evidence-v2', dayId: 'W11D6', schemaVersion: 2, validateLesson: validateW11D6Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w12d1ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'project-brief-gate-observer-day01-v1', dayId: 'W12D1', validateLesson: validateW12D1Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w12d1EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w12d1-evidence-v2', dayId: 'W12D1', schemaVersion: 2, validateLesson: validateW12D1Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w12d2ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'system-data-plan-gate-observer-day01-v1', dayId: 'W12D2', validateLesson: validateW12D2Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w12d2EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w12d2-evidence-v2', dayId: 'W12D2', schemaVersion: 2, validateLesson: validateW12D2Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w12d3ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'runnable-validation-log-gate-observer-day01-v1', dayId: 'W12D3', validateLesson: validateW12D3Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w12d3EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w12d3-evidence-v2', dayId: 'W12D3', schemaVersion: 2, validateLesson: validateW12D3Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w12d4ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'risk-register-gate-observer-day01-v1', dayId: 'W12D4', validateLesson: validateW12D4Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w12d4EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w12d4-evidence-v2', dayId: 'W12D4', schemaVersion: 2, validateLesson: validateW12D4Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w12d5ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'review-notes-gate-observer-day01-v1', dayId: 'W12D5', validateLesson: validateW12D5Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w12d5EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w12d5-evidence-v2', dayId: 'W12D5', schemaVersion: 2, validateLesson: validateW12D5Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

const w12d6ExperimentAdapter = Object.freeze({
  kind: 'experiment', key: 'portfolio-package-gate-observer-day01-v1', dayId: 'W12D6', validateLesson: validateW12D6Experiment,
} as const satisfies DailyCourseExperimentAdapter)

const w12d6EvidenceAdapter = Object.freeze({
  kind: 'evidence', key: 'w12d6-evidence-v2', dayId: 'W12D6', schemaVersion: 2, validateLesson: validateW12D6Evidence,
} as const satisfies DailyCourseEvidenceAdapter)

/**
 * A Day becomes learner-available only after content, a domain experiment,
 * an evidence adapter and a reviewed renderer are all registered here.
 * Entries hold concrete implementation objects rather than self-attested
 * strings, so route rendering and release inventory share the same bindings.
 */
const implementationEntries = [
  {
    dayId: 'W1D1',
    renderer: w1d1Renderer,
    experimentAdapter: w1d1ExperimentAdapter,
    evidenceAdapter: w1d1EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W1D2',
    renderer: w1d2Renderer,
    experimentAdapter: w1d2ExperimentAdapter,
    evidenceAdapter: w1d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W1D3',
    renderer: w1d3Renderer,
    experimentAdapter: w1d3ExperimentAdapter,
    evidenceAdapter: w1d3EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W1D4',
    renderer: w1d4Renderer,
    experimentAdapter: w1d4ExperimentAdapter,
    evidenceAdapter: w1d4EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W1D5',
    renderer: w1d5Renderer,
    experimentAdapter: w1d5ExperimentAdapter,
    evidenceAdapter: w1d5EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W3D1',
    renderer: w3d1Renderer,
    experimentAdapter: w3d1ExperimentAdapter,
    evidenceAdapter: w3d1EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W3D2',
    renderer: w3d2Renderer,
    experimentAdapter: w3d2ExperimentAdapter,
    evidenceAdapter: w3d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W3D3',
    renderer: w3d3Renderer,
    experimentAdapter: w3d3ExperimentAdapter,
    evidenceAdapter: w3d3EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W3D4',
    renderer: w3d4Renderer,
    experimentAdapter: w3d4ExperimentAdapter,
    evidenceAdapter: w3d4EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W3D5',
    renderer: w3d5Renderer,
    experimentAdapter: w3d5ExperimentAdapter,
    evidenceAdapter: w3d5EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W3D6',
    renderer: w3d6Renderer,
    experimentAdapter: w3d6ExperimentAdapter,
    evidenceAdapter: w3d6EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W4D1',
    renderer: w4d1Renderer,
    experimentAdapter: w4d1ExperimentAdapter,
    evidenceAdapter: w4d1EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W4D2',
    renderer: w4d2Renderer,
    experimentAdapter: w4d2ExperimentAdapter,
    evidenceAdapter: w4d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W4D3',
    renderer: w4d3Renderer,
    experimentAdapter: w4d3ExperimentAdapter,
    evidenceAdapter: w4d3EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W4D4',
    renderer: w4d4Renderer,
    experimentAdapter: w4d4ExperimentAdapter,
    evidenceAdapter: w4d4EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W5D2',
    renderer: w5d2Renderer,
    experimentAdapter: w5d2ExperimentAdapter,
    evidenceAdapter: w5d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W8D1',
    renderer: w8d1Renderer,
    experimentAdapter: w8d1ExperimentAdapter,
    evidenceAdapter: w8d1EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W8D2',
    renderer: w8d2Renderer,
    experimentAdapter: w8d2ExperimentAdapter,
    evidenceAdapter: w8d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W8D6',
    renderer: w8d6Renderer,
    experimentAdapter: w8d6ExperimentAdapter,
    evidenceAdapter: w8d6EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W9D3',
    renderer: w9d3Renderer,
    experimentAdapter: w9d3ExperimentAdapter,
    evidenceAdapter: w9d3EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W11D1',
    renderer: w11d1Renderer,
    experimentAdapter: w11d1ExperimentAdapter,
    evidenceAdapter: w11d1EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W11D2',
    renderer: w11d2Renderer,
    experimentAdapter: w11d2ExperimentAdapter,
    evidenceAdapter: w11d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W11D3',
    renderer: w11d3Renderer,
    experimentAdapter: w11d3ExperimentAdapter,
    evidenceAdapter: w11d3EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W11D4',
    renderer: w11d4Renderer,
    experimentAdapter: w11d4ExperimentAdapter,
    evidenceAdapter: w11d4EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W11D5',
    renderer: w11d5Renderer,
    experimentAdapter: w11d5ExperimentAdapter,
    evidenceAdapter: w11d5EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W11D6',
    renderer: w11d6Renderer,
    experimentAdapter: w11d6ExperimentAdapter,
    evidenceAdapter: w11d6EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W12D1',
    renderer: w12d1Renderer,
    experimentAdapter: w12d1ExperimentAdapter,
    evidenceAdapter: w12d1EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W12D2',
    renderer: w12d2Renderer,
    experimentAdapter: w12d2ExperimentAdapter,
    evidenceAdapter: w12d2EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W12D3',
    renderer: w12d3Renderer,
    experimentAdapter: w12d3ExperimentAdapter,
    evidenceAdapter: w12d3EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W12D4',
    renderer: w12d4Renderer,
    experimentAdapter: w12d4ExperimentAdapter,
    evidenceAdapter: w12d4EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W12D5',
    renderer: w12d5Renderer,
    experimentAdapter: w12d5ExperimentAdapter,
    evidenceAdapter: w12d5EvidenceAdapter,
    reviewed: true,
  },
  {
    dayId: 'W12D6',
    renderer: w12d6Renderer,
    experimentAdapter: w12d6ExperimentAdapter,
    evidenceAdapter: w12d6EvidenceAdapter,
    reviewed: true,
  },
] as const satisfies readonly DailyCourseImplementation[]

const implementationByDayId = new Map<DayId, DailyCourseImplementation>()
for (const entry of implementationEntries) {
  if (implementationByDayId.has(entry.dayId)) throw new Error(`Duplicate DailyCourse implementation: ${entry.dayId}`)
  implementationByDayId.set(entry.dayId, entry)
}

function pushContractIssues(
  issues: DailyCourseImplementationIssue[],
  code: 'experiment-contract-failed' | 'evidence-contract-failed',
  label: string,
  validateLesson: (lesson: DailyCourse) => readonly string[],
  lesson: DailyCourse,
) {
  try {
    const contractIssues = validateLesson(lesson)
    if (!Array.isArray(contractIssues)) {
      issues.push({ code, message: `${label}契约没有返回问题数组。` })
      return
    }
    for (const message of contractIssues) {
      if (typeof message !== 'string' || !message.trim()) {
        issues.push({ code, message: `${label}契约返回了无效问题。` })
      } else {
        issues.push({ code, message: `${label}契约失败：${message}` })
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    issues.push({ code, message: `${label}契约执行失败：${detail}` })
  }
}

export function validateDailyCourseImplementation(
  implementation: DailyCourseImplementation,
  lesson: DailyCourse | undefined,
): readonly DailyCourseImplementationIssue[] {
  const dayId = implementation.dayId
  const issues: DailyCourseImplementationIssue[] = []

  if (!lesson) {
    issues.push({ code: 'content-missing', message: `${dayId} 的实现没有对应完整课程内容。` })
  } else if (lesson.id !== implementation.dayId) {
    issues.push({ code: 'content-day-mismatch', message: `${dayId} 的实现绑定了 ${lesson.id} 课程内容。` })
  }

  if (implementation.renderer.kind !== 'renderer') {
    issues.push({ code: 'renderer-kind-mismatch', message: `${dayId} 的 renderer 类型无效。` })
  }
  if (implementation.renderer.dayId !== implementation.dayId) {
    issues.push({ code: 'renderer-day-mismatch', message: `${dayId} 绑定了 ${implementation.renderer.dayId} 的 renderer ${implementation.renderer.key}。` })
  }
  if (typeof implementation.renderer.load !== 'function') {
    issues.push({ code: 'renderer-loader-missing', message: `${dayId} 的 renderer ${implementation.renderer.key} 没有可调用模块加载器。` })
  }

  if (implementation.experimentAdapter.kind !== 'experiment') {
    issues.push({ code: 'experiment-kind-mismatch', message: `${dayId} 的实验适配器类型无效。` })
  }
  if (implementation.experimentAdapter.dayId !== implementation.dayId) {
    issues.push({ code: 'experiment-day-mismatch', message: `${dayId} 绑定了 ${implementation.experimentAdapter.dayId} 的实验适配器 ${implementation.experimentAdapter.key}。` })
  }
  if (typeof implementation.experimentAdapter.validateLesson !== 'function') {
    issues.push({ code: 'experiment-validator-missing', message: `${dayId} 的实验适配器 ${implementation.experimentAdapter.key} 没有可调用契约。` })
  } else if (lesson) {
    pushContractIssues(issues, 'experiment-contract-failed', `实验适配器 ${implementation.experimentAdapter.key}`, implementation.experimentAdapter.validateLesson, lesson)
  }

  if (implementation.evidenceAdapter.kind !== 'evidence') {
    issues.push({ code: 'evidence-kind-mismatch', message: `${dayId} 的证据适配器类型无效。` })
  }
  if (implementation.evidenceAdapter.dayId !== implementation.dayId) {
    issues.push({ code: 'evidence-day-mismatch', message: `${dayId} 绑定了 ${implementation.evidenceAdapter.dayId} 的证据适配器 ${implementation.evidenceAdapter.key}。` })
  }
  if (!Number.isInteger(implementation.evidenceAdapter.schemaVersion) || implementation.evidenceAdapter.schemaVersion < 1) {
    issues.push({ code: 'evidence-schema-missing', message: `${dayId} 的证据适配器 ${implementation.evidenceAdapter.key} 没有有效 schemaVersion。` })
  }
  if (typeof implementation.evidenceAdapter.validateLesson !== 'function') {
    issues.push({ code: 'evidence-validator-missing', message: `${dayId} 的证据适配器 ${implementation.evidenceAdapter.key} 没有可调用契约。` })
  } else if (lesson) {
    pushContractIssues(issues, 'evidence-contract-failed', `证据适配器 ${implementation.evidenceAdapter.key}`, implementation.evidenceAdapter.validateLesson, lesson)
  }

  return issues
}

export function inspectDailyCourseImplementation(
  dayId: DayId,
  lesson: DailyCourse | undefined,
): DailyCourseImplementationInspection {
  const implementation = implementationByDayId.get(dayId)
  if (!implementation) {
    return {
      dayId,
      resolved: false,
      issues: [{ code: 'implementation-missing', message: `${dayId} 没有实现注册项。` }],
    }
  }

  const issues = validateDailyCourseImplementation(implementation, lesson)

  return {
    dayId,
    implementation,
    resolved: Boolean(lesson) && issues.length === 0,
    issues,
  }
}

export function listDailyCourseImplementations(): readonly DailyCourseImplementation[] {
  return [...implementationByDayId.values()]
}

export function getDayImplementation(dayId: DayId): DailyCourseImplementation | undefined {
  return implementationByDayId.get(dayId)
}
