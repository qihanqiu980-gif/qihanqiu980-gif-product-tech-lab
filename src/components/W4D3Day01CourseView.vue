<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyExerciseEvidence, DailyLessonEvidenceState, LessonConsoleEntry, PrerequisiteDecision } from './DailyLessonView.vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import type { Day01ChapterId, Day01FrameworkChapter } from '../course/day01Framework'
import { getW4D3FrameworkPlan } from '../course/w4d3Framework'
import { countSubstantiveContribution } from '../course/evidenceQuality'
import { assessChapterRetell, buildRetellReferenceAnswer } from '../course/retellAssessment'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<infer U> ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }
type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'
type MetricScenario =
  | 'base-events-cte'
  | 'active-users'
  | 'same-day-conversion'
  | 'rolling-24h-conversion'
  | 'unique-paid-orders'
  | 'aov-and-guards'

interface ChapterEvidence {
  learn: boolean
  selectedIndex: number | null
  practicePassed: boolean
  retell: string
  retellSubmitted: boolean
  retellAttempts: number
}

type W4D3Evidence = DailyLessonEvidenceState & {
  contentVersion: string
  frameworkChapters: Record<Day01ChapterId, ChapterEvidence>
}

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<W4D3Evidence>
  durationMode?: 30 | 45
  readonly?: boolean
}>(), { durationMode: 45, readonly: false })

const emit = defineEmits<{
  navigate: [view: ProductView]
  'update:evidenceState': [state: DailyLessonEvidenceState]
  'save-attempt': [payload: { lessonId: string; sectionId: LessonSectionId; state: DailyLessonEvidenceState }]
  'section-complete': [payload: { lessonId: string; sectionId: LessonSectionId }]
  'lesson-complete': [payload: { lessonId: string; completedAt: string; state: DailyLessonEvidenceState }]
  'next-lesson-request': [payload: { from: string; to: string }]
}>()

const plan = (() => {
  const resolved = getW4D3FrameworkPlan(props.lesson.id)
  if (!resolved) throw new Error(`${props.lesson.id} 缺少 Day 01 七章框架。`)
  return resolved
})()

const lessonRoot = ref<HTMLElement | null>(null)
const mobileRoute = ref<HTMLDetailsElement | null>(null)
const activeChapterId = ref<Day01ChapterId>('chapter-1')
const announcement = ref('')
const deviceMode = ref<'desktop' | 'mobile'>('desktop')
let chapterObserver: IntersectionObserver | undefined
let scrollOwner: HTMLElement | null = null
let scrollFrame: number | undefined
let syncingExternalState = false

function blankExerciseEvidence(): DailyExerciseEvidence {
  return { selectedIndex: null, response: '', submitted: false, hintVisible: false, selfAssessment: '', attemptCount: 0, remediationVisited: false, correctionNote: '' }
}

function blankEvidence(): W4D3Evidence {
  return {
    schemaVersion: 2,
    lessonId: props.lesson.id,
    contentVersion: props.lesson.contentVersion,
    prerequisiteDecisions: Object.fromEntries(props.lesson.prerequisites.map((item) => [item.id, '' as PrerequisiteDecision])),
    visitedConceptIds: [], expandedConceptIds: [], completedSections: [],
    sandbox: { activePanel: 'elements', previewHeadline: '指标计算练习台', domDraft: '', domEdits: 0, ageInput: 'base-events-cte', buttonState: 'idle', buttonClicks: 0, consoleHistory: [] },
    guidedLab: { prediction: '', stepComplete: {}, observations: {}, records: {}, comparison: '', passChecks: {} },
    independentLab: { changedCondition: '', prediction: '', plan: '', evidence: '', result: '', conclusion: '', passChecks: {} },
    exerciseAnswers: Object.fromEntries(props.lesson.exercises.map((exercise) => [exercise.id, blankExerciseEvidence()])),
    deliverable: { draft: props.lesson.deliverable.standardTemplate, touched: false, templateKind: 'guided', checklist: {} },
    memory: { anchorChecks: {}, closedBook: '', microOperation: '', unresolved: '', reviewChecks: {} },
    frameworkChapters: Object.fromEntries(plan.chapters.map((chapter) => [chapter.id, { learn: false, selectedIndex: null, practicePassed: false, retell: '', retellSubmitted: false, retellAttempts: 0, }])) as Record<Day01ChapterId, ChapterEvidence>,
  }
}

function safeRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, T> : {}
}

function mergeEvidence(source?: DeepPartial<W4D3Evidence>): W4D3Evidence {
  const base = blankEvidence()
  if (!source || source.lessonId !== props.lesson.id || source.contentVersion !== props.lesson.contentVersion) return base
  const chapters = safeRecord<Partial<ChapterEvidence>>(source.frameworkChapters)
  const exercises = safeRecord<Partial<DailyExerciseEvidence>>(source.exerciseAnswers)
  return {
    ...base, ...source, schemaVersion: 2, lessonId: props.lesson.id, contentVersion: props.lesson.contentVersion,
    prerequisiteDecisions: { ...base.prerequisiteDecisions, ...safeRecord<PrerequisiteDecision>(source.prerequisiteDecisions) },
    visitedConceptIds: Array.isArray(source.visitedConceptIds) ? source.visitedConceptIds.filter((id): id is string => typeof id === 'string') : [],
    expandedConceptIds: Array.isArray(source.expandedConceptIds) ? source.expandedConceptIds.filter((id): id is string => typeof id === 'string') : [],
    completedSections: Array.isArray(source.completedSections) ? source.completedSections : [],
    sandbox: { ...base.sandbox, ...source.sandbox, consoleHistory: Array.isArray(source.sandbox?.consoleHistory) ? source.sandbox.consoleHistory as LessonConsoleEntry[] : [] },
    guidedLab: { ...base.guidedLab, ...source.guidedLab, stepComplete: { ...base.guidedLab.stepComplete, ...safeRecord<boolean>(source.guidedLab?.stepComplete) }, observations: { ...base.guidedLab.observations, ...safeRecord<string>(source.guidedLab?.observations) }, records: { ...base.guidedLab.records, ...safeRecord<string>(source.guidedLab?.records) }, passChecks: { ...base.guidedLab.passChecks, ...safeRecord<boolean>(source.guidedLab?.passChecks) } },
    independentLab: { ...base.independentLab, ...source.independentLab, passChecks: { ...base.independentLab.passChecks, ...safeRecord<boolean>(source.independentLab?.passChecks) } },
    exerciseAnswers: Object.fromEntries(props.lesson.exercises.map((exercise) => [exercise.id, { ...blankExerciseEvidence(), ...exercises[exercise.id] }])),
    deliverable: { ...base.deliverable, ...source.deliverable, checklist: { ...base.deliverable.checklist, ...safeRecord<boolean>(source.deliverable?.checklist) } },
    memory: { ...base.memory, ...source.memory, anchorChecks: { ...base.memory.anchorChecks, ...safeRecord<boolean>(source.memory?.anchorChecks) }, reviewChecks: { ...base.memory.reviewChecks, ...safeRecord<boolean>(source.memory?.reviewChecks) } },
    frameworkChapters: Object.fromEntries(plan.chapters.map((chapter) => [chapter.id, { ...base.frameworkChapters[chapter.id], ...chapters[chapter.id] }])) as Record<Day01ChapterId, ChapterEvidence>,
  }
}

const evidence = ref<W4D3Evidence>(mergeEvidence(props.evidenceState))
const activePath = computed(() => props.lesson.learningPaths[String(props.durationMode) as '30' | '45'])
const exerciseSet = computed(() => props.lesson.exercises.slice(0, activePath.value.exerciseCount))
const guidedSteps = computed(() => activePath.value.guidedStepIndices.map((index) => ({ index, step: props.lesson.guidedLab.steps[index] })).filter((item) => item.step))
const guidedRecords = computed(() => activePath.value.guidedRecordIndices.map((index) => ({ index, prompt: props.lesson.guidedLab.recordPrompts[index] })).filter((item) => item.prompt))
const checklistSet = computed(() => activePath.value.deliverableChecklistIndices.map((index) => ({ index, item: props.lesson.deliverable.checklist[index] })).filter((item) => item.item))
const sessionOneChapters = computed(() => plan.chapters.filter((chapter) => chapter.session === 1))
const sessionTwoChapters = computed(() => plan.chapters.filter((chapter) => chapter.session === 2))
const sessionOneMinutes = computed(() => sessionOneChapters.value.reduce((total, chapter) => total + chapter.timeMinutes, 0))
const sessionTwoMinutes = computed(() => sessionTwoChapters.value.reduce((total, chapter) => total + chapter.timeMinutes, 0))
const sessionOneTitles = computed(() => sessionOneChapters.value.map((chapter) => chapter.title.replace(/^.*?：/, '')).join('、'))
const sessionTwoTitles = computed(() => sessionTwoChapters.value.map((chapter) => chapter.title.replace(/^.*?：/, '')).join('、'))
const visibleCourseMinutes = computed(() => sessionOneMinutes.value + sessionTwoMinutes.value)
const completedStatusCount = computed(() => plan.chapters.reduce((total, chapter) => {
  const state = evidence.value.frameworkChapters[chapter.id]
  return total + Number(state.learn) + Number(state.practicePassed) + Number(state.retellSubmitted)
}, 0))
const progressPercent = computed(() => Math.round(completedStatusCount.value / 21 * 100))
const allPrerequisitesPassed = computed(() => props.lesson.prerequisites.every((item) => evidence.value.prerequisiteDecisions[item.id] === 'pass'))

function cloneEvidence(): W4D3Evidence { return JSON.parse(JSON.stringify(evidence.value)) as W4D3Evidence }
function publish() { if (syncingExternalState) return; evidence.value.savedAt = new Date().toISOString(); emit('update:evidenceState', cloneEvidence()) }
function emitSection(sectionId: LessonSectionId) { emit('section-complete', { lessonId: props.lesson.id, sectionId }) }
function saveAttempt(sectionId: LessonSectionId) { publish(); emit('save-attempt', { lessonId: props.lesson.id, sectionId, state: cloneEvidence() }) }
function setSectionComplete(sectionId: LessonSectionId, complete: boolean) {
  const sections = new Set(evidence.value.completedSections)
  if (complete) sections.add(sectionId); else sections.delete(sectionId)
  sections.delete('completion'); evidence.value.completedSections = [...sections]; delete evidence.value.completedAt
  if (complete) emitSection(sectionId)
}
function conceptsFor(chapter: Day01FrameworkChapter) { const ids = new Set(chapter.conceptIds); return props.lesson.concepts.filter((concept) => ids.has(concept.id)) }
function syncConceptCompletion() { setSectionComplete('concepts', props.lesson.concepts.every((concept) => evidence.value.visitedConceptIds.includes(concept.id))) }
function updatePrerequisite() { setSectionComplete('prerequisites', evidence.value.frameworkChapters['chapter-1'].learn && allPrerequisitesPassed.value); publish() }

function toggleChapterLearn(chapter: Day01FrameworkChapter) {
  if (props.readonly) return
  const state = evidence.value.frameworkChapters[chapter.id]; state.learn = !state.learn
  if (state.learn) {
    evidence.value.visitedConceptIds = [...new Set([...evidence.value.visitedConceptIds, ...chapter.conceptIds])]
    if (chapter.number === 1) { setSectionComplete('scenario', true); setSectionComplete('objectives', true); setSectionComplete('prerequisites', allPrerequisitesPassed.value) }
    if (chapter.number === 5) { setSectionComplete('diagram', true); setSectionComplete('demonstration', true) }
  } else {
    const retained = new Set(plan.chapters.filter((item) => item.id !== chapter.id && evidence.value.frameworkChapters[item.id].learn).flatMap((item) => item.conceptIds))
    evidence.value.visitedConceptIds = evidence.value.visitedConceptIds.filter((id) => retained.has(id))
    if (chapter.number === 1) { setSectionComplete('scenario', false); setSectionComplete('objectives', false); setSectionComplete('prerequisites', false) }
    if (chapter.number === 5) { setSectionComplete('diagram', false); setSectionComplete('demonstration', false) }
  }
  syncConceptCompletion(); publish()
}
function submitChapterPractice(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  if (state.selectedIndex === null) return
  state.practicePassed = state.selectedIndex === chapter.practice.answerIndex
  announcement.value = state.practicePassed ? `第 ${chapter.number} 章练习通过。` : `第 ${chapter.number} 章需要回看系统阶段与证据边界。`
  publish()
}
function submitChapterRetell(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  const assessment = assessChapterRetell(chapter, state.retell)
  if (assessment.passed) {
    state.retellSubmitted = true
    state.retellAttempts = 0
    announcement.value = `第 ${chapter.number} 章复述通过核验，已保存为待复核，不代表掌握。`
    publish()
    return
  }
  state.retellSubmitted = false
  state.retellAttempts = (state.retellAttempts ?? 0) + 1
  announcement.value = state.retellAttempts >= 2
    ? `第 ${chapter.number} 章复述未通过。${assessment.reason} 参考答案：${buildRetellReferenceAnswer(chapter)}`
    : `第 ${chapter.number} 章复述未通过。${assessment.reason} 先不给出参考答案，请按量规补齐后再提交。`
  publish()
}

function onChapterRetellInput(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  if (state.retellSubmitted || (state.retellAttempts ?? 0) >= 2) state.retellAttempts = 0
  state.retellSubmitted = false
  publish()
}
function resetChapterCheckpoint(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  state.selectedIndex = null; state.practicePassed = false; state.retell = ''; state.retellSubmitted = false; state.retellAttempts = 0
  announcement.value = `第 ${chapter.number} 章练习与复述已清空；学习状态和历史正式提交未删除。`; publish()
}
function chapterComplete(chapter: Day01FrameworkChapter) { const state = evidence.value.frameworkChapters[chapter.id]; return state.learn && state.practicePassed && state.retellSubmitted }
function chapterStatusLabel(chapter: Day01FrameworkChapter) { const state = evidence.value.frameworkChapters[chapter.id]; return chapterComplete(chapter) ? '三项完成' : `${Number(state.learn) + Number(state.practicePassed) + Number(state.retellSubmitted)}/3` }

const metricSampleRows = [
  { metric_name: 'active_users', sql_snippet: 'COUNT(DISTINCT user_id) FROM base_events WHERE event_name IN ("coupon_exposure","checkout_view","payment_success")', result_value: 'active_users=10', sample_check: 'TEST 排除' },
  { metric_name: 'exposure_to_pay', sql_snippet: 'ROUND(paid_same_day_users / exposed_users, 4)', result_value: '0.4000', sample_check: 'U03 不计入自然日支付' },
  { metric_name: 'checkout_to_pay_24h', sql_snippet: 'payment_time < datetime(checkout_time, "+24 hours")', result_value: '0.5714', sample_check: 'U03 超过 24 小时' },
  { metric_name: 'unique_paid_orders', sql_snippet: 'COUNT(DISTINCT order_id) FROM payment_success', result_value: 'unique_paid_orders=5', sample_check: 'O05 重复事件只算一单' },
  { metric_name: 'aov_amount', sql_snippet: 'ROUND(AVG(amount), 2) FROM unique paid orders', result_value: 'aov_amount=2077.00', sample_check: 'O06 9999 元' },
] as const

const firstCompleteMetric = {
  metric_name: 'active_users',
  metric_ref: 'active_user_sql / W4D1 metric-contract-table.md',
  aggregation_ref: 'W4D2 count-distinct-user',
  business_question: '2026-09-07 教学样本里有多少非测试唯一活跃用户。',
  base_cte: 'WITH base_events AS (...) 排除 is_test=1，保留 event_name、event_time、user_id、order_id、amount。',
  sql_snippet: 'COUNT(DISTINCT CASE WHEN event_name IN ("coupon_exposure","checkout_view","payment_success") THEN user_id END) AS active_users',
  denominator: '不适用',
  numerator: '不适用',
  distinct_key: 'user_id',
  time_window: '2026-09-07 教学自然日',
  result_value: 'active_users=10',
  sample_check: 'TEST 被排除',
  can_prove: '能证明本地教学样本按活动事件集合有 10 个唯一活跃用户。',
  cannot_prove: '不能证明真实生产 DAU、真实埋点覆盖、JOIN、归因、趋势、看板可发布或 W4D4 已完成。',
  next_review_task: 'W4D4 检查分母变化、幸存者偏差和异常大单造成的上涨假象。',
} as const

const metricTasks = [
  {
    id: 'base-events-cte',
    label: '输入底座',
    target: 'metric-calculation.md + self_check.sql',
    mode: '教学模拟',
    businessQuestion: '为什么所有指标都要先经过同一份 base CTE。',
    sql: 'WITH base_events AS (...) 先排除 TEST 再保留后续指标要用的字段。',
    expected: '同一批教学输入让活跃、转化、订单和金额可比较。',
    actual: 'base_events 固定了 is_test=0、event_name、event_time、user_id、order_id 和 amount。',
    field: 'base_cte',
    metric: 'base_events',
    conclusion: 'shared_input_makes_metrics_comparable',
    action: '记录 base_cte、metric_ref 和 sample_check。',
    canProve: '能证明后续指标共用同一批非测试输入。',
    cannotProve: '不能证明真实生产数据仓库或埋点覆盖。',
    deliverableHint: '补 base_cte、metric_ref、sample_check、can_prove、cannot_prove。',
  },
  {
    id: 'active-users',
    label: '活跃用户',
    target: 'metric-calculation.md + self_check.sql',
    mode: '教学模拟',
    businessQuestion: '哪些非测试唯一用户参与了漏斗活动。',
    sql: 'COUNT(DISTINCT user_id) FROM base_events WHERE event_name IN ("coupon_exposure","checkout_view","payment_success")',
    expected: '先定活动事件集合，再按 user_id 去重。',
    actual: 'active_users=10。',
    field: 'metric_name',
    metric: 'active_users',
    conclusion: 'active_user_sql_needs_a_shared_base',
    action: '记录 metric_name、metric_ref、distinct_key 和 result_value。',
    canProve: '能证明本地教学样本里 active_users=10。',
    cannotProve: '不能证明真实 DAU 或产品使用质量。',
    deliverableHint: '补 metric_name、metric_ref、sql_snippet、result_value、sample_check。',
  },
  {
    id: 'same-day-conversion',
    label: '自然日转化',
    target: 'metric-calculation.md + self_check.sql',
    mode: '教学模拟',
    businessQuestion: '曝光用户中有多少人在同一自然日支付。',
    sql: 'ROUND(paid_same_day_users / exposed_users, 4)',
    expected: '分母和分子都按 user_id 去重，并共享自然日边界。',
    actual: 'exposed_users=10; paid_same_day_users=4; exposure_to_pay=0.4000。',
    field: 'time_window',
    metric: 'exposure_to_pay',
    conclusion: 'same_day_window_changes_rate',
    action: '记录分母、分子、窗口和结果值。',
    canProve: '能证明本地教学样本中自然日口径得到 0.4000。',
    cannotProve: '不能证明真实生产转化率、原因、趋势或看板发布。',
    deliverableHint: '补 denominator、numerator、time_window、result_value、sample_check。',
  },
  {
    id: 'rolling-24h-conversion',
    label: '滚动 24 小时转化',
    target: 'metric-calculation.md + self_check.sql',
    mode: '教学模拟',
    businessQuestion: '结算页用户在结算后 24 小时内有多少人支付。',
    sql: 'checkout_view users matched to payment_success within 24h',
    expected: '滚动窗口按每个 checkout_view 的发生时间起算，不是统一到次日午夜。',
    actual: 'checkout_users=7; paid_within_24h_users=4; checkout_to_pay_24h=0.5714。',
    field: 'time_window',
    metric: 'checkout_to_pay_24h',
    conclusion: 'u03_excluded_by_24h_window',
    action: '记录 checkout_users、paid_within_24h_users 和 U03 边界。',
    canProve: '能证明本地教学样本可区分自然日窗口和滚动 24 小时窗口。',
    cannotProve: '不能证明生产时区规则或跨设备归因已批准。',
    deliverableHint: '补 time_window、sample_check=U03、result_value。',
  },
  {
    id: 'unique-paid-orders',
    label: '唯一支付订单',
    target: 'metric-calculation.md + self_check.sql',
    mode: '教学模拟',
    businessQuestion: '非测试 payment_success 中有多少唯一支付订单。',
    sql: 'COUNT(DISTINCT order_id) WHERE event_name="payment_success" AND is_test=0',
    expected: '重复 payment_success 事件不能重复增加订单数。',
    actual: 'unique_paid_orders=5；O05 重复事件只算一单。',
    field: 'distinct_key',
    metric: 'unique_paid_orders',
    conclusion: 'distinct_protects_order_grain',
    action: '记录 distinct_key=order_id 和 O05 重复边界。',
    canProve: '能证明本地教学表按订单粒度去重后有 5 个支付订单。',
    cannotProve: '不能修复重复事件根因或证明生产去重规则已批准。',
    deliverableHint: '补 distinct_key、result_value、sample_check=O05。',
  },
  {
    id: 'aov-and-guards',
    label: 'AOV 与护栏',
    target: 'metric-calculation.md + self_check.sql',
    mode: '教学模拟',
    businessQuestion: '支付金额平均值能否代表典型订单。',
    sql: 'SUM(amount), AVG(amount), median_amount, max_amount FROM unique paid orders',
    expected: 'SUM 回答总量，AVG 回答平均水平，并对照中位数和最大值。',
    actual: 'unique_paid_orders=5; total_amount=10385.00; average_amount=2077.00; median_amount=89.00; max_amount=9999.00。',
    field: 'sample_check',
    metric: 'aov_amount',
    conclusion: 'avg_needs_outlier_guard',
    action: '记录 O06 9999 元如何拉高 AVG。',
    canProve: '能证明本地教学样本中平均值受异常大单影响。',
    cannotProve: '不能证明真实客单价、异常原因或运营效果。',
    deliverableHint: '补 result_value、sample_check=O06、can_prove、cannot_prove。',
  },
] as const satisfies ReadonlyArray<{
  id: MetricScenario
  label: string
  target: string
  mode: string
  businessQuestion: string
  sql: string
  expected: string
  actual: string
  field: string
  metric: string
  conclusion: string
  action: string
  canProve: string
  cannotProve: string
  deliverableHint: string
}>

const metricScenarioValues = metricTasks.map((task) => task.id)
const currentMetricScenario = computed<MetricScenario>(() => {
  const value = evidence.value.sandbox.ageInput
  return metricScenarioValues.includes(value as MetricScenario) ? value as MetricScenario : 'base-events-cte'
})
const currentMetricRun = computed(() => {
  const scenario = currentMetricScenario.value
  const task = metricTasks.find((item) => item.id === scenario) ?? metricTasks[0]
  return { ...task, evidenceLimit: '只能证明本地 events 教学表中的指标计算可复核，不能证明真实生产指标、JOIN、归因、趋势、看板发布或 W4D4 已完成' }
})
const metricCoverage = computed(() => {
  const commands = evidence.value.sandbox.consoleHistory.map((entry) => entry.command)
  return Object.fromEntries(metricTasks.map((task) => [task.id, commands.some((item) => item.includes(task.id))])) as Record<MetricScenario, boolean>
})
function runMetricObserver() {
  const run = currentMetricRun.value; evidence.value.sandbox.buttonClicks += 1
  const runId = `w4d3-aggregation-${String(evidence.value.sandbox.buttonClicks).padStart(3, '0')}`
  evidence.value.sandbox.consoleHistory.push({ command: `${runId}|${currentMetricScenario.value}`, output: `${run.field} → ${run.conclusion}`, tone: 'normal' })
  evidence.value.guidedLab.observations['latest-metric-run'] = `${runId} · ${run.label} · field=${run.field} · conclusion=${run.conclusion}`
  announcement.value = `已追加 ${runId}；这是本地教学模拟，只形成指标计算证据，不证明真实生产指标、JOIN、归因、趋势、看板发布或 W4D4 已完成。`; publish()
}
function resetMetricObserver() {
  const blank = blankEvidence(); evidence.value.sandbox = blank.sandbox; evidence.value.guidedLab = blank.guidedLab
  setSectionComplete('guided-lab', false); announcement.value = '指标计算观察器与当前草稿已清空；历史正式尝试未删除。'; publish()
}
function completeGuidedLab() {
  const stepsReady = guidedSteps.value.every(({ index }) => evidence.value.guidedLab.stepComplete[String(index)])
  const recordsReady = guidedRecords.value.every(({ index }) => (evidence.value.guidedLab.records[String(index)] || '').trim().length >= 8)
  const checksReady = props.lesson.guidedLab.passCriteria.every((_, index) => evidence.value.guidedLab.passChecks[String(index)])
  if (evidence.value.guidedLab.prediction.trim().length < 12 || !Object.values(metricCoverage.value).every(Boolean) || !stepsReady || !recordsReady || !checksReady) { announcement.value = '先完成预测、6 条指标路径、引导步骤、记录与通过标准。'; return }
  setSectionComplete('guided-lab', true); saveAttempt('guided-lab'); announcement.value = '指标计算实操证据已追加保存；它只证明本地教学模拟中的计算顺序可复核。'
}
function completeIndependentLab() {
  const state = evidence.value.independentLab
  const checksReady = props.lesson.independentLab.passCriteria.every((_, index) => state.passChecks[String(index)])
  if (![state.changedCondition, state.prediction, state.plan, state.evidence, state.result, state.conclusion].every((value) => value.trim().length >= 8) || !checksReady) { announcement.value = '独立变式需要完整条件、预测、计划、证据、结果、结论和自检。'; return }
  setSectionComplete('independent-lab', true); saveAttempt('independent-lab'); announcement.value = '独立变式已追加保存，结论仍待量规复核。'
}
function resetIndependentLab() { evidence.value.independentLab = blankEvidence().independentLab; setSectionComplete('independent-lab', false); announcement.value = '独立变式已清空；历史正式尝试未删除。'; publish() }

function exerciseState(exercise: Exercise) { return evidence.value.exerciseAnswers[exercise.id] }
function submitExercise(exercise: Exercise) {
  const state = exerciseState(exercise); if (state.selectedIndex === null) return
  state.submitted = true; state.attemptCount += 1; state.submittedAt = new Date().toISOString(); state.selfAssessment = state.selectedIndex === exercise.answerIndex ? 'pass' : 'retry'
  syncExerciseCompletion(); publish()
}
function resetExercise(exercise: Exercise) { evidence.value.exerciseAnswers[exercise.id] = blankExerciseEvidence(); syncExerciseCompletion(); announcement.value = '本题已回到未作答状态；历史正式尝试未删除。'; publish() }
function syncExerciseCompletion() {
  const ready = exerciseSet.value.every((exercise) => { const state = exerciseState(exercise); return state.submitted && state.selfAssessment === 'pass' })
  const wasReady = evidence.value.completedSections.includes('exercises'); setSectionComplete('exercises', ready); setSectionComplete('feedback', ready)
  if (ready && !wasReady) saveAttempt('exercises')
}
function useDeliverableTemplate(kind: 'guided' | 'blank') {
  evidence.value.deliverable.templateKind = kind; evidence.value.deliverable.draft = kind === 'guided' ? props.lesson.deliverable.standardTemplate : props.lesson.deliverable.blankTemplate
  evidence.value.deliverable.touched = false; evidence.value.deliverable.checklist = {}; setSectionComplete('deliverable', false); publish()
}
const deliverableContribution = computed(() => countSubstantiveContribution(evidence.value.deliverable.draft, evidence.value.deliverable.templateKind === 'blank' ? props.lesson.deliverable.blankTemplate : props.lesson.deliverable.standardTemplate))
const validationFields = ['metric_name', 'metric_ref', 'aggregation_ref', 'business_question', 'base_cte', 'sql_snippet', 'denominator', 'numerator', 'distinct_key', 'time_window', 'result_value', 'sample_check', 'can_prove', 'cannot_prove', 'next_review_task'] as const
const deliverableGate = computed(() => {
  const text = evidence.value.deliverable.draft
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const errors: string[] = []
  const fieldPresence = Object.fromEntries(validationFields.map((field) => [field, lower.includes(field)])) as Record<(typeof validationFields)[number], boolean>
  for (const field of validationFields) if (!fieldPresence[field]) errors.push(`缺少字段：${field}。`)
  const requiredBoundaryPhrases = ['metric-calculation.md', '不能证明', 'active_users', 'exposure_to_pay', 'checkout_to_pay_24h', 'unique_paid_orders', 'aov_amount', 'median_amount', 'TEST', 'U03', 'O05', 'O06', 'W4D4']
  for (const phrase of requiredBoundaryPhrases) if (!text.includes(phrase)) errors.push(`必须写明边界或下一步：${phrase}。`)
  const forbiddenClaims = [
    ['真实生产', '已证明'], ['业务指标', '正确'], ['指标', '已经正确'], ['JOIN', '已完成'], ['看板', '可发布'], ['归因', '完成'],
    ['W4D3', '已完成'],
  ]
  for (const [subject, claim] of forbiddenClaims) {
    if (text.includes(subject) && text.includes(claim)) errors.push(`不得越界声明：${subject}${claim}。`)
  }
  const metricNameReady = /metric_name[\s\S]{0,220}(active_users|exposure_to_pay|checkout_to_pay_24h|unique_paid_orders|aov_amount)/i.test(text)
  const metricRefReady = /metric_ref[\s\S]{0,260}(W4D1|metric-contract|metric_id|口径)/i.test(text)
  const questionReady = /business_question[\s\S]{0,320}(曝光|支付|订单|金额|转化|分组|样本)/i.test(text)
  const inputReady = /base_cte[\s\S]{0,520}(events|event_name|is_test|coupon_exposure|payment_success|checkout_view|非测试)/i.test(text)
  const whereReady = /sql_snippet[\s\S]{0,520}(COUNT|DISTINCT|SUM|AVG|WHERE|event_name|is_test|event_time|>=|<|datetime)/i.test(text)
  const aggregateReady = /sql_snippet[\s\S]{0,520}(COUNT|DISTINCT|SUM|AVG|ROUND|median_amount|max_amount)/i.test(text)
  const distinctReady = /distinct_key[\s\S]{0,260}(user_id|order_id|不适用|去重)/i.test(text)
  const groupReady = /time_window[\s\S]{0,260}(自然日|24 小时|不适用|window|边界)/i.test(text)
  const havingReady = /sample_check[\s\S]{0,320}(U03|O05|TEST|O06|重复|24 小时|异常)/i.test(text)
  const resultReady = /result_value[\s\S]{0,620}(10|4|0\.4000|0\.5714|5|2077|10385|9999)/i.test(text)
  const edgeReady = /sample_check[\s\S]{0,620}(U03|O05|TEST|O06|9999|重复|24 小时|异常)/i.test(text)
  const canReady = /can_prove[\s\S]{0,460}(能证明|本地|教学|聚合|口径|可复核)/i.test(text)
  const cannotReady = /cannot_prove[\s\S]{0,760}(不能证明|真实生产|JOIN|归因|趋势|看板|W4D4|指标正确)/i.test(text)
  const nextReady = /next_review_task[\s\S]{0,420}(W4D4|指标计算 SQL|下一课)/i.test(text)
  if (!metricNameReady) errors.push('metric_name 必须写出指标名称。')
  if (!metricRefReady) errors.push('metric_ref 必须引用 W4D1 口径。')
  if (!questionReady) errors.push('business_question 必须写出业务问题。')
  if (!inputReady) errors.push('base_cte 必须写出公共输入。')
  if (!whereReady) errors.push('sql_snippet 必须写出核心 SQL 片段。')
  if (!aggregateReady) errors.push('sql_snippet 必须写出 COUNT/DISTINCT/SUM/AVG/ROUND 等函数。')
  if (!distinctReady) errors.push('distinct_key 必须写出去重键或不适用。')
  if (!groupReady) errors.push('time_window 必须写出自然日或滚动 24 小时窗口。')
  if (!havingReady) errors.push('sample_check 必须写出 TEST、U03、O05 或 O06 等边界。')
  if (!resultReady) errors.push('result_value 必须写出本地教学结果。')
  if (!edgeReady) errors.push('sample_check 必须解释 U03、O05、TEST 或 O06 等边界。')
  if (!canReady) errors.push('can_prove 必须限定到本地教学指标计算可复核。')
  if (!cannotReady) errors.push('cannot_prove 必须排除真实生产、JOIN、归因、趋势、看板或 W4D4 已完成。')
  if (!nextReady) errors.push('next_review_task 必须指向 W4D4。')
  return { valid: errors.length === 0, errors, lineCount: lines.length, fieldPresence, presentFields: validationFields.filter((field) => fieldPresence[field]).length }
})
const deliverableFieldStatus = computed(() => validationFields.map((field) => ({ field, done: deliverableGate.value.fieldPresence[field] })))
function completeDeliverable() {
  const checksReady = checklistSet.value.every(({ index }) => evidence.value.deliverable.checklist[String(index)])
  if (deliverableContribution.value < activePath.value.deliverableMinimumContributionCharacters || !checksReady || !deliverableGate.value.valid) { announcement.value = `成果需要至少 ${activePath.value.deliverableMinimumContributionCharacters} 个有效实写字符、完成自检，并通过指标计算字段门禁。`; return }
  setSectionComplete('deliverable', true); saveAttempt('deliverable'); announcement.value = 'metric-calculation.md 已作为待审核成果追加保存；真实生产指标、JOIN、归因、趋势、看板发布和 W4D4 完成状态仍未判定。'
}
function resetDeliverable() { useDeliverableTemplate('guided'); announcement.value = '成果草稿已恢复初始模板；历史提交未删除。' }
function completeMemory() {
  const anchors = props.lesson.memory.anchors.every((_, index) => evidence.value.memory.anchorChecks[String(index)])
  const reviews = props.lesson.memory.reviewStages.every((_, index) => evidence.value.memory.reviewChecks[String(index)])
  if (!anchors || !reviews || evidence.value.memory.closedBook.trim().length < 60 || evidence.value.memory.microOperation.trim().length < 16) { announcement.value = '先完成全部记忆锚点、至少 60 字闭卷复述、微操作和六阶段排程。'; return }
  setSectionComplete('memory', true); saveAttempt('memory'); announcement.value = '最终复述已进入待复核，不直接表示掌握。'
}
function resetMemory() { evidence.value.memory = blankEvidence().memory; setSectionComplete('memory', false); announcement.value = '闭卷复述与复习确认已清空；历史提交未删除。'; publish() }

const canCompleteCourse = computed(() => {
  const required: LessonSectionId[] = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory']
  return plan.chapters.every(chapterComplete) && required.every((section) => evidence.value.completedSections.includes(section))
})
function completeCourse() {
  if (!canCompleteCourse.value) return
  const completedAt = new Date().toISOString(); evidence.value.completedSections = [...new Set<LessonSectionId>([...evidence.value.completedSections, 'completion'])]; evidence.value.completedAt = completedAt
  publish(); emit('lesson-complete', { lessonId: props.lesson.id, completedAt, state: cloneEvidence() })
}

function goToChapter(chapter: Day01FrameworkChapter) {
  activeChapterId.value = chapter.id; if (mobileRoute.value?.open) mobileRoute.value.open = false
  void nextTick(() => {
    const element = document.getElementById(`${props.lesson.id.toLowerCase()}-${chapter.id}`); if (!element) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const owner = lessonRoot.value?.closest<HTMLElement>('.main-canvas')
    if (owner) {
      const appbar = deviceMode.value === 'mobile' ? (lessonRoot.value?.querySelector<HTMLElement>('.w1-appbar')?.offsetHeight ?? 0) : 0
      const route = deviceMode.value === 'mobile' ? (mobileRoute.value?.offsetHeight ?? 0) : 0
      const targetTop = element.getBoundingClientRect().top - owner.getBoundingClientRect().top + owner.scrollTop - appbar - route - 8
      owner.scrollTo({ top: targetTop, behavior: reduceMotion ? 'auto' : 'smooth' })
    } else element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => element.focus({ preventScroll: true }), reduceMotion ? 0 : 520)
  })
}
function syncActiveChapterFromScroll() {
  const anchor = deviceMode.value === 'mobile' ? 160 : 96
  const chapters = [...(lessonRoot.value?.querySelectorAll<HTMLElement>('[data-framework-chapter]') ?? [])]
  const current = chapters.reduce<HTMLElement | undefined>((nearest, element) => element.getBoundingClientRect().top <= anchor ? element : nearest, chapters[0])
  const id = current?.getAttribute('data-framework-chapter') as Day01ChapterId | null; if (id) activeChapterId.value = id
}
function onScrollOwnerScroll() { if (scrollFrame !== undefined) return; scrollFrame = window.requestAnimationFrame(() => { scrollFrame = undefined; syncActiveChapterFromScroll() }) }
function observeChapters() {
  chapterObserver?.disconnect(); scrollOwner?.removeEventListener('scroll', onScrollOwnerScroll); scrollOwner = lessonRoot.value?.closest<HTMLElement>('.main-canvas') ?? null
  scrollOwner?.addEventListener('scroll', onScrollOwnerScroll, { passive: true })
  if ('IntersectionObserver' in window) { chapterObserver = new IntersectionObserver(syncActiveChapterFromScroll, { root: scrollOwner, rootMargin: '-80px 0px -55% 0px', threshold: [0, .08, .25] }); lessonRoot.value?.querySelectorAll<HTMLElement>('[data-framework-chapter]').forEach((element) => chapterObserver?.observe(element)) }
  syncActiveChapterFromScroll()
}
function syncDeviceMode() { deviceMode.value = window.innerWidth <= 860 ? 'mobile' : 'desktop' }

watch(() => props.evidenceState, (source) => {
  if (!source) return; const incoming = mergeEvidence(source); if (JSON.stringify(incoming) === JSON.stringify(evidence.value)) return
  syncingExternalState = true; evidence.value = incoming; void nextTick(() => { syncingExternalState = false })
}, { deep: true })
onMounted(() => { syncDeviceMode(); window.addEventListener('resize', syncDeviceMode); observeChapters() })
onBeforeUnmount(() => { window.removeEventListener('resize', syncDeviceMode); scrollOwner?.removeEventListener('scroll', onScrollOwnerScroll); if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame); chapterObserver?.disconnect() })
</script>

<template>
  <article ref="lessonRoot" class="day01-course" :data-device="deviceMode" :aria-labelledby="`${lesson.id}-title`">
    <aside class="w1-global-sidebar" aria-label="主要导航">
      <button class="w1-global-brand" type="button" aria-label="产品技术实验室" @click="emit('navigate', 'today')"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h9v9H5zM18 7.5h9M18 12h9M18 16.5h6M5 20.5h22M5 25h15" /></svg><span><strong>产品技术</strong><small>实验室</small></span></button>
      <nav class="w1-global-nav">
        <button type="button" @click="emit('navigate', 'today')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v14H4zM8 3.5v4M16 3.5v4M4 9.5h16M8 13h3M8 16h6" /></svg><span>今日</span></button>
        <button type="button" class="is-current" aria-current="page" @click="emit('navigate', 'course')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h5M11 12h5" /></svg><span>课程</span></button>
        <button type="button" @click="emit('navigate', 'review')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 8V3M5 8h5M12 7v5l3 2" /></svg><span>复盘</span></button>
        <button type="button" @click="emit('navigate', 'progress')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7M3 19.5h18" /></svg><span>进度</span></button>
        <button type="button" @click="emit('navigate', 'glossary')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h4M11 12h3" /></svg><span>概念</span></button>
      </nav>
      <div class="w1-global-footer"><div class="w1-weight-key" aria-label="学习能力权重"><span><i></i>数据 40%</span><span><i></i>沟通 30%</span><span><i></i>评审 30%</span></div><button class="w1-archive-action" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 11l4 4 4-4M5 19h14" /></svg><span>旧课档案</span></button></div>
    </aside>

    <div class="w1-window">
      <header class="w1-appbar"><button type="button" class="w1-brand" @click="emit('navigate', 'today')"><span class="w1-brand-mark">PL</span><strong>产品技术实验室</strong></button><span class="w1-appbar-meta">COURSE / W4D3</span></header>
      <div class="w1-shell">
        <main class="w1-main">
          <header class="course-cover">
            <div><p class="eyebrow">WEEK 4 · DAY 3 · 双时段课程</p><h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1><p class="subtitle">{{ lesson.subtitle }}</p></div>
            <div class="cover-summary" aria-label="课程时间与进度"><div class="cover-summary-head"><strong>{{ visibleCourseMinutes }} 分钟</strong><span>建议分两次完成</span></div><div class="cover-progress"><i :style="{ width: `${progressPercent}%` }"></i></div><div class="cover-summary-labels"><span>本次专注 {{ durationMode }} 分钟</span><span>两时段 · 七章</span></div><div class="cover-evidence"><span>已学习 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].learn).length }}/7</span><span>练习通过 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].practicePassed).length }}/7</span><span>待复核复述 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].retellSubmitted).length }}/7</span><span>掌握未判定</span></div></div>
          </header>
          <section class="session-strip" aria-label="两个学习时段"><div class="session-card"><strong>第一时段 · {{ sessionOneMinutes }} 分钟</strong><span>{{ sessionOneTitles }}</span></div><div class="session-card"><strong>第二时段 · {{ sessionTwoMinutes }} 分钟</strong><span>{{ sessionTwoTitles }}</span></div></section>
          <details ref="mobileRoute" class="w1-mobile-route"><summary>章节目录 · {{ plan.chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1 }} / 7 {{ plan.chapters.find((chapter) => chapter.id === activeChapterId)?.title }}</summary><nav class="w1-route-list" aria-label="W4D3 移动端七章目录"><button v-for="chapter in plan.chapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></nav></details>
          <div class="course-protocol"><span>指标计算不是一串孤立数字</span><p>本课只用 W4 本地 events 教学表建立 `metric-calculation.md`：先写 metric_name、metric_ref、aggregation_ref 和 base_cte，再补 sql_snippet、denominator、numerator、distinct_key、time_window、result_value、sample_check、can_prove、cannot_prove 和 next_review_task。不连接真实数据库、不读取公司数据，也不把教学指标计算写成真实生产指标、JOIN、归因、趋势、看板可发布或 W4D4 已完成。前置不足只提示补学，不锁全文。</p></div>
          <p v-if="announcement" class="announcement" role="status" aria-live="polite">{{ announcement }}</p>

          <div class="manuscript">
            <section v-for="chapter in plan.chapters" :id="`${lesson.id.toLowerCase()}-${chapter.id}`" :key="chapter.id" class="framework-chapter" :data-framework-chapter="chapter.id" tabindex="-1">
              <header class="chapter-head"><div><span>SESSION {{ String(chapter.session).padStart(2, '0') }} · CHAPTER {{ String(chapter.number).padStart(2, '0') }}</span><h2>{{ chapter.title }}</h2><p>{{ chapter.lead }}</p></div><strong>{{ chapter.timeMinutes }} MIN</strong></header>

              <template v-if="chapter.number === 1">
                <div class="scenario-copy"><p><b>你的角色</b>{{ lesson.scenario.role }}</p><p><b>发生了什么</b>{{ lesson.scenario.situation }}</p><blockquote>{{ lesson.scenario.question }}</blockquote><p><b>为什么重要</b>{{ lesson.scenario.stakes }}</p></div>
                <div class="plain-section">
                  <h3>今天先看见对象：指标计算 SQL</h3>
                  <p>今天学的是把口径和聚合逻辑落成指标 SQL 输出。先不要做 JOIN 或发布指标结论，先确认 base CTE，再计算 active_users、exposure_to_pay、checkout_to_pay_24h、unique_paid_orders 和 aov_amount。</p>
                  <div class="system-console" aria-label="指标计算样本">
	                    <p class="simulation-label">来自 W4 本地 events 教学表的指标计算样本</p>
	                    <table>
                      <thead><tr><th>metric_name</th><th>sql_snippet</th><th>result_value</th><th>sample_check</th></tr></thead>
                      <tbody>
                        <tr v-for="row in metricSampleRows" :key="row.metric_name">
                          <td>{{ row.metric_name }}</td><td>{{ row.sql_snippet }}</td><td>{{ row.result_value }}</td><td>{{ row.sample_check }}</td>
                        </tr>
                      </tbody>
	                    </table>
	                  </div>
	                </div>
	                <div class="plain-section">
	                  <h3>先看一条完整指标，再拆概念</h3>
                  <p>先看一条能从头到尾解释的指标计算记录，再进入 metric_name、metric_ref、base_cte、sql_snippet、result_value 和 sample_check。这样学习者先知道“今天到底在计算什么”，再把字段拆开。</p>
	                  <dl class="stage-ledger">
	                    <div><dt>指标名称</dt><dd>{{ firstCompleteMetric.metric_name }}</dd></div>
	                    <div><dt>口径引用</dt><dd>{{ firstCompleteMetric.metric_ref }}</dd></div>
	                    <div><dt>聚合引用</dt><dd>{{ firstCompleteMetric.aggregation_ref }}</dd></div>
	                    <div><dt>业务问题</dt><dd>{{ firstCompleteMetric.business_question }}</dd></div>
	                    <div><dt>公共输入</dt><dd>{{ firstCompleteMetric.base_cte }}</dd></div>
	                    <div><dt>SQL 片段</dt><dd>{{ firstCompleteMetric.sql_snippet }}</dd></div>
	                    <div><dt>去重键</dt><dd>{{ firstCompleteMetric.distinct_key }}</dd></div>
	                    <div><dt>时间窗口</dt><dd>{{ firstCompleteMetric.time_window }}</dd></div>
	                    <div><dt>结果值</dt><dd>{{ firstCompleteMetric.result_value }}</dd></div>
	                    <div><dt>样本核对</dt><dd>{{ firstCompleteMetric.sample_check }}</dd></div>
	                    <div><dt>能证明什么</dt><dd>{{ firstCompleteMetric.can_prove }}</dd></div>
	                    <div><dt>不能证明什么</dt><dd>{{ firstCompleteMetric.cannot_prove }}</dd></div>
	                    <div><dt>下一步复核</dt><dd>{{ firstCompleteMetric.next_review_task }}</dd></div>
	                  </dl>
	                </div>
	                <div class="plain-section"><h3>学完后要交出的证据</h3><ol class="objective-list"><li v-for="objective in lesson.objectives" :key="objective.id"><strong>{{ objective.text }}</strong><span>{{ objective.evidence }}</span></li></ol></div>
	                <div class="prerequisite-panel"><div><h3>跨阶段提前观看：提醒，不锁全文</h3><p>即使 W4D1 或前序课程未完成，也可从路线或深链直接阅读完整 W4D3。当前只检查你是否能读懂 W4D1 口径和 W4D2 聚合逻辑；缺口只限制 `metric-calculation.md` 的实操结论，不隐藏课程。</p></div><fieldset v-for="item in lesson.prerequisites" :key="item.id"><legend>{{ item.prompt }}</legend><p>{{ item.passDescription }}</p><div class="decision-row"><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="pass" :disabled="readonly" @change="updatePrerequisite">已能独立做到</label><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="remediate" :disabled="readonly" @change="updatePrerequisite">需要先补学</label></div><div v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'" class="remediation"><b>{{ item.remediationLabel }}</b><ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol><a :href="item.remediationTarget">打开补学课程</a></div></fieldset></div>
              </template>

              <div v-if="chapter.number === 2 || chapter.number === 3" class="concept-ledger"><article v-for="concept in conceptsFor(chapter)" :id="`concept-${concept.id}`" :key="concept.id"><header><div><small>{{ concept.english }}</small><h3>{{ concept.term }}</h3></div><span>{{ concept.systemPosition }}</span></header><p class="concept-definition">{{ concept.definition }}</p><div class="concept-why"><p><b>为什么需要它</b>{{ concept.why }}</p><p><b>解决什么问题</b>{{ concept.problemSolved }}</p></div><dl><div><dt>输入</dt><dd>{{ concept.input }}</dd></div><div><dt>输出</dt><dd>{{ concept.output }}</dd></div><div><dt>责任人</dt><dd>{{ concept.owner }}</dd></div><div><dt>不负责</dt><dd>{{ concept.notResponsibleFor }}</dd></div><div><dt>与相邻层比较</dt><dd>{{ concept.compareWith }}</dd></div><div><dt>可观察证据</dt><dd>{{ concept.evidence.join('；') }}</dd></div></dl><ol class="concept-process"><li v-for="step in concept.process" :key="step">{{ step }}</li></ol><p class="pm-use"><b>产品经理怎样用：</b>{{ concept.pmUse }}</p><div class="example-pair"><div><b>正确例子</b>{{ concept.correctExample }}</div><div><b>越界例子</b>{{ concept.incorrectExample }}</div></div></article></div>

              <div v-if="chapter.number === 4" class="understanding-map"><span>metric_ref</span><i>→</i><span>base_cte</span><i>→</i><span>sql_snippet</span><i>→</i><span>denominator</span><i>→</i><span>numerator</span><i>→</i><span>result_value</span><i>→</i><span>sample_check</span><p>先把每条指标绑定到 W4D1 口径和 W4D2 聚合引用，再用 events 教学表固定 base CTE，随后计算活跃、转化、唯一支付订单和 AOV。最后用 can_prove、cannot_prove 和 next_review_task 说明结果能交接到哪里，以及为什么 W4D4 才分析上涨假象。</p></div>

              <template v-if="chapter.number === 5">
                <figure class="relationship-map"><figcaption><strong>{{ lesson.diagram.title }}</strong><span>{{ lesson.diagram.caption }}</span></figcaption><ol><li v-for="node in lesson.diagram.nodes" :key="node.id"><strong>{{ node.label }}</strong><p>{{ node.description }}</p><small>输入：{{ node.input }} · 输出：{{ node.output }}</small></li></ol><ul><li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind"><span>{{ branch.from }}</span><i>→</i><b>{{ branch.label }}</b><i>→</i><span>{{ branch.to }}</span></li></ul><div><b>读图时找这些证据</b><p v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</p></div></figure>
                <div class="demonstration"><h3>{{ lesson.demonstration.title }}</h3><p><b>业务问题：</b>{{ lesson.demonstration.businessProblem }}</p><ol><li v-for="(step, index) in lesson.demonstration.steps" :key="step.title"><span>{{ index + 1 }}</span><div><h4>{{ step.title }}</h4><p><b>教师操作：</b>{{ step.action }}</p><p><b>为什么：</b>{{ step.reason }}</p><p><b>看到：</b>{{ step.evidence }}</p><p><b>能证明：</b>{{ step.proves }}</p><p><b>不能证明：</b>{{ step.limitation }}</p></div></li></ol><div id="demonstration-conclusion" class="limited-conclusion"><p><b>有限结论：</b>{{ lesson.demonstration.finalConclusion }}</p><p><b>结论限制：</b>{{ lesson.demonstration.conclusionLimit }}</p></div></div>
                <div class="lab-panel">
                  <div class="lab-title"><div><span>教学模拟</span><h3>{{ lesson.guidedLab.title }}</h3><p>{{ lesson.guidedLab.goal }}</p></div><small>{{ lesson.guidedLab.safety }}</small></div>
                  <label class="field"><span>先预测</span><small>{{ lesson.guidedLab.predictionPrompt }}</small><textarea v-model="evidence.guidedLab.prediction" rows="3" :readonly="readonly" aria-label="指标计算 实验预测" @input="publish" /></label>
                  <div class="system-console">
                    <p class="simulation-label">教学模拟 · 只读取 W4 本地 events 教学表素材，不调用真实数据库、账号、Token、公司数据或生产系统</p>
                    <label><span>选择一道指标路径</span><select v-model="evidence.sandbox.ageInput" :disabled="readonly" aria-label="指标计算 教学场景" @change="publish"><option v-for="task in metricTasks" :key="task.id" :value="task.id">{{ task.label }}</option></select></label>
                    <dl class="stage-ledger">
                      <div><dt>业务问题</dt><dd>{{ currentMetricRun.businessQuestion }}</dd></div>
                      <div><dt>期望</dt><dd>{{ currentMetricRun.expected }}</dd></div>
                      <div><dt>实际看到什么</dt><dd>{{ currentMetricRun.actual }}</dd></div>
                      <div><dt>能证明什么</dt><dd>{{ currentMetricRun.canProve }}</dd></div>
                      <div><dt>不能证明什么</dt><dd>{{ currentMetricRun.cannotProve }}</dd></div>
                      <div><dt>写入字段</dt><dd>{{ currentMetricRun.field }} · {{ currentMetricRun.metric }}</dd></div>
                      <div><dt>Evidence limit</dt><dd>{{ currentMetricRun.evidenceLimit }}</dd></div>
                    </dl>
                    <p class="first-fork"><b>{{ currentMetricRun.label }}：</b>{{ currentMetricRun.action }}</p>
                    <div class="console-actions"><button type="button" :disabled="readonly" @click="runMetricObserver">运行并追加记录</button><button type="button" class="secondary" :disabled="readonly" @click="resetMetricObserver">全部清空并重做</button></div>
                    <ol v-if="evidence.sandbox.consoleHistory.length" class="exchange-history" aria-label="指标计算 教学模拟追加历史"><li v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${entry.command}-${index}`"><code>{{ entry.command }}</code><span>{{ entry.output }}</span></li></ol>
                    <div class="simulation-coverage" aria-label="指标计算 实验覆盖"><span v-for="task in metricTasks" :key="task.id" :class="{ done: metricCoverage[task.id] }">{{ task.label }}</span></div>
                  </div>
                  <ol class="lab-steps">
                    <li v-for="task in metricTasks" :key="task.id">
                      <label><input :checked="metricCoverage[task.id]" type="checkbox" disabled><span><b>{{ task.label }}</b>{{ task.action }}</span></label>
                      <dl class="stage-ledger">
                        <div><dt>业务问题</dt><dd>{{ task.businessQuestion }}</dd></div>
                        <div><dt>定义草稿</dt><dd>{{ task.sql }}</dd></div>
                        <div><dt>预期</dt><dd>{{ task.expected }}</dd></div>
                        <div><dt>实际看到</dt><dd>{{ task.actual }}</dd></div>
                        <div><dt>能证明</dt><dd>{{ task.canProve }}</dd></div>
	                        <div><dt>不能证明</dt><dd>{{ task.cannotProve }}</dd></div>
	                        <div><dt>本题生成字段</dt><dd>{{ task.deliverableHint }}</dd></div>
	                      </dl>
	                    </li>
                  </ol>
                  <ol class="lab-steps"><li v-for="item in guidedSteps" :key="item.index"><label><input v-model="evidence.guidedLab.stepComplete[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish"><span><b>{{ item.step.title }}</b>{{ item.step.action }}</span></label><p>观察：{{ item.step.observe }}</p><small>能证明：{{ item.step.proves }}；不能证明：{{ item.step.cannotProve }}</small></li></ol>
                  <div class="record-grid"><label v-for="item in guidedRecords" :key="item.index"><span>{{ item.prompt }}</span><textarea v-model="evidence.guidedLab.records[String(item.index)]" rows="3" :readonly="readonly" @input="publish" /></label></div>
                  <div class="check-list"><label v-for="(item, index) in lesson.guidedLab.passCriteria" :key="item"><input v-model="evidence.guidedLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div>
                  <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeGuidedLab">保存引导实验尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetMetricObserver">全部清空并重做</button></div>
                </div>
              </template>

              <template v-if="chapter.number === 6">
                <div class="boundary-table"><h3>先修常见误判</h3><dl><div><dt>base CTE 没先定</dt><dd>“直接 COUNT(*)”不能执行。先固定 base_cte，再讨论 SQL 片段。</dd></div><div><dt>只看总数不看去重</dt><dd>O05 重复 payment_success 会把订单数放大；订单粒度必须先写 distinct_key。</dd></div><div><dt>自然日和 24 小时混写</dt><dd>U03 在滚动 24 小时口径里不计入，但在自然日口径里会变化。</dd></div><div><dt>平均值当典型值</dt><dd>O06 的 9999 元会把 AOV 拉高；要对照中位数和最大值。</dd></div><div><dt>分母分子不分</dt><dd>转化率必须同时写 denominator 与 numerator。</dd></div><div><dt>时间窗口不清</dt><dd>time_window 必须写明自然日或滚动 24 小时。</dd></div></dl></div>
                <div class="independent-panel"><h3>{{ lesson.independentLab.title }}</h3><p>{{ lesson.independentLab.scenario }}</p><label><span>改变一个条件</span><select v-model="evidence.independentLab.changedCondition" :disabled="readonly" @change="publish"><option value="">请选择</option><option v-for="item in lesson.independentLab.changedConditions" :key="item" :value="item">{{ item }}</option></select></label><label><span>先预测</span><small>{{ lesson.independentLab.predictionPrompt }}</small><textarea v-model="evidence.independentLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label><label><span>检查计划</span><textarea v-model="evidence.independentLab.plan" rows="5" :readonly="readonly" aria-label="指标计算记录 检查计划" @input="publish" /></label><label><span>命令与证据</span><textarea v-model="evidence.independentLab.evidence" rows="5" :readonly="readonly" aria-label="指标计算记录 命令证据" @input="publish" /></label><label><span>观察结果</span><textarea v-model="evidence.independentLab.result" rows="3" :readonly="readonly" aria-label="指标计算记录 观察结果" @input="publish" /></label><label><span>四句有限结论</span><textarea v-model="evidence.independentLab.conclusion" rows="4" :readonly="readonly" aria-label="指标计算记录 有限结论" @input="publish" /></label><div class="check-list"><label v-for="(item, index) in lesson.independentLab.passCriteria" :key="item"><input v-model="evidence.independentLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeIndependentLab">保存独立变式尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetIndependentLab">清空并重做</button></div></div>
              </template>

              <template v-if="chapter.number === 7">
                <div class="practice-workshop"><h3>针对性练习</h3><p>先作答，再看逐项解释；输入行、去重键、SUM/AVG、GROUP BY 和 HAVING 不能混写，更不能提前声称 JOIN、归因、趋势或真实业务指标正确。</p><article v-for="(exercise, index) in exerciseSet" :key="exercise.id"><header><span>{{ index + 1 }}</span><div><h4>{{ exercise.prompt }}</h4><small>{{ exercise.categories.join(' · ') }}</small></div></header><div class="answer-options"><label v-for="(option, optionIndex) in exercise.options" :key="option.label"><input v-model="exerciseState(exercise).selectedIndex" type="radio" :name="exercise.id" :value="optionIndex" :disabled="readonly || exerciseState(exercise).submitted" @change="publish"><span>{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option.label }}</label></div><div v-if="exerciseState(exercise).submitted" :class="['exercise-feedback', exerciseState(exercise).selfAssessment]"><b>{{ exerciseState(exercise).selfAssessment === 'pass' ? '当前通过' : '对照后修正' }}</b><p>{{ exercise.referenceAnswer }}</p><ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol><p><b>逐项解释：</b>{{ exercise.options?.map((option) => `${option.label}：${option.rationale}；${option.couldBeTrueWhen}`).join('；') }}</p><p><b>常见错因：</b>{{ exercise.commonErrors.map((item) => `${item.error}：${item.reason}`).join('；') }}</p></div><div class="panel-actions"><button v-if="!exerciseState(exercise).submitted" type="button" :disabled="readonly" @click="submitExercise(exercise)">提交本题</button><button type="button" class="secondary" :disabled="readonly" @click="resetExercise(exercise)">清空并重做</button></div></article></div>
	                <div class="deliverable-panel"><h3>{{ lesson.deliverable.title }}</h3><p>{{ lesson.deliverable.purpose }}</p><p>不要先面对整张验收清单。先按指标计算字段逐项生成记录：先写 metric_name、metric_ref、aggregation_ref 和 business_question，再补 base_cte、sql_snippet、denominator、numerator、distinct_key、time_window、result_value、sample_check、can_prove、cannot_prove 和 next_review_task。</p><div class="field-ledger"><div><b>第 1 步：指标与引用</b><p>metric_name、metric_ref、aggregation_ref。</p><small>例：checkout_to_pay_24h；引用 W4D1 口径和 W4D2 聚合逻辑。</small></div><div><b>第 2 步：问题与输入</b><p>business_question、base_cte、sql_snippet。</p><small>先固定公共输入，再写核心 SQL 片段。</small></div><div><b>第 3 步：分母、分子与窗口</b><p>denominator、numerator、distinct_key、time_window。</p><small>活跃、转化、订单和 AOV 的粒度不能混写。</small></div><div><b>第 4 步：结果与边界</b><p>result_value、sample_check、can_prove、cannot_prove、next_review_task。</p><small>每条都要承认不能证明真实生产、JOIN、归因、趋势、看板发布或 W4D4 已完成。</small></div></div><details open><summary>每条指标完成后该补哪些成果字段</summary><ol><li v-for="item in lesson.deliverable.fields" :key="item.name"><b>{{ item.name }}：</b>{{ item.meaning }}；来源：{{ item.source }}</li></ol></details><div class="field-ledger"><div v-for="field in lesson.deliverable.fields" :key="field.name"><b>{{ field.name }}</b><p>{{ field.meaning }}</p><small>证据来源：{{ field.source }}</small></div></div><details><summary>先看一份差稿怎样修正</summary><blockquote>{{ lesson.deliverable.badExample }}</blockquote><p><b>差稿问题：</b>{{ lesson.deliverable.badReasons.join('；') }}</p><ol><li v-for="item in lesson.deliverable.revisionSteps" :key="item">{{ item }}</li></ol><pre>{{ lesson.deliverable.goodExample }}</pre></details><div class="template-actions"><button type="button" :disabled="readonly" @click="useDeliverableTemplate('guided')">使用引导模板</button><button type="button" class="secondary" :disabled="readonly" @click="useDeliverableTemplate('blank')">使用空白模板</button></div><textarea v-model="evidence.deliverable.draft" rows="18" spellcheck="false" :readonly="readonly" :aria-label="`${lesson.deliverable.title} Markdown 草稿`" @input="evidence.deliverable.touched = true; setSectionComplete('deliverable', false); publish()" /><p class="counter">有效实写 {{ deliverableContribution }} / {{ activePath.deliverableMinimumContributionCharacters }} 字符 · 指标记录字段 {{ deliverableGate.presentFields }}/15 · 非空行 {{ deliverableGate.lineCount }} · 边界门禁 {{ deliverableGate.valid ? '通过' : '待修复' }}</p><div class="simulation-coverage" aria-label="指标计算 逐项字段配额"><span v-for="item in deliverableFieldStatus" :key="item.field" :class="{ done: item.done }">{{ item.field }}</span><span :class="{ done: deliverableGate.valid }">{{ deliverableGate.valid ? '指标计算 valid' : '指标计算 待修复' }}</span></div><details v-if="deliverableGate.errors.length" class="remediation"><summary>查看指标计算门禁错误（{{ deliverableGate.errors.length }}）</summary><ol><li v-for="error in deliverableGate.errors" :key="error">{{ error }}</li></ol></details><div class="check-list"><label v-for="item in checklistSet" :key="item.index"><input v-model="evidence.deliverable.checklist[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item.item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeDeliverable">校验并保存 metric-calculation.md</button><button type="button" class="secondary" :disabled="readonly" @click="resetDeliverable">清空并重做</button></div></div>
                <div class="memory-panel"><h3>最终复述与复习排程</h3><div class="check-list"><label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor"><input v-model="evidence.memory.anchorChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ anchor }}</label></div><label><span>闭卷解释</span><small>{{ lesson.memory.closedBookPrompt }}</small><textarea v-model="evidence.memory.closedBook" rows="6" :readonly="readonly" aria-label="W4D3 最终闭卷解释" @input="publish" /></label><label><span>微操作</span><small>{{ lesson.memory.microOperation }}</small><textarea v-model="evidence.memory.microOperation" rows="3" :readonly="readonly" aria-label="W4D3 记忆微操作" @input="publish" /></label><label><span>仍未解决的问题</span><small>{{ lesson.memory.unresolvedPrompt }}</small><textarea v-model="evidence.memory.unresolved" rows="3" :readonly="readonly" aria-label="W4D3 未解决问题" @input="publish" /></label><div class="review-timeline"><label v-for="(stage, index) in lesson.memory.reviewStages" :key="stage.stage"><input v-model="evidence.memory.reviewChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish"><b>{{ stage.stage }}</b><span>{{ stage.task }}</span></label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeMemory">保存最终复述与复习计划</button><button type="button" class="secondary" :disabled="readonly" @click="resetMemory">清空并重做</button></div></div>
                <div class="course-completion"><h3>完成核验</h3><p>完成页面不等于掌握；本课只记录已学习、练习通过、待复核复述、实操证据与待审核成果。W4D3 完成后下一步只说明 W4D4 的三种上涨假象，不创建或修改 W4D4 内容。</p><button type="button" :disabled="readonly || !canCompleteCourse" @click="completeCourse">记录本课首学完成</button><button v-if="lesson.nextLesson" type="button" class="secondary" @click="emit('next-lesson-request', { from: lesson.id, to: lesson.nextLesson!.id })">查看下一课说明</button></div>
              </template>

              <div class="chapter-checkpoint"><div class="checkpoint-heading"><div><span>本章小闭环</span><h3>学习、练习、复述分别保存</h3></div><button type="button" class="reset-link" :disabled="readonly" @click="resetChapterCheckpoint(chapter)">清空练习与复述</button></div><button type="button" :class="['learn-toggle', { done: evidence.frameworkChapters[chapter.id].learn }]" :disabled="readonly" :aria-pressed="evidence.frameworkChapters[chapter.id].learn" @click="toggleChapterLearn(chapter)">{{ evidence.frameworkChapters[chapter.id].learn ? '已学习 · 再按撤销' : '标记本章已学习' }}</button><fieldset><legend>{{ chapter.practice.prompt }}</legend><label v-for="(option, index) in chapter.practice.options" :key="option"><input v-model="evidence.frameworkChapters[chapter.id].selectedIndex" type="radio" :name="`${chapter.id}-practice`" :value="index" :disabled="readonly" @change="publish"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</label></fieldset><div class="checkpoint-actions"><button type="button" :disabled="readonly || evidence.frameworkChapters[chapter.id].selectedIndex === null" @click="submitChapterPractice(chapter)">检查本章练习</button><p v-if="evidence.frameworkChapters[chapter.id].selectedIndex !== null" :class="{ passed: evidence.frameworkChapters[chapter.id].practicePassed }">{{ evidence.frameworkChapters[chapter.id].practicePassed ? chapter.practice.explanation : '未通过：回到本章系统阶段、责任与证据边界后重试。' }}</p></div><label class="retell-field"><span>{{ chapter.retellPrompt }}</span><small>量规：{{ chapter.retellRubric.join('；') }}</small><textarea v-model="evidence.frameworkChapters[chapter.id].retell" rows="4" :readonly="readonly" :aria-label="`第 ${chapter.number} 章复述`" @input="onChapterRetellInput(chapter)" /></label><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts > 0 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-feedback">{{ evidence.frameworkChapters[chapter.id].retellAttempts >= 2 ? '第二次仍未通过，对照参考答案重写后再提交。' : '未通过：按量规补齐后再提交；本次先不显示参考答案。' }}</p><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts >= 2 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-answer"><b>参考答案</b>{{ buildRetellReferenceAnswer(chapter) }}</p><div class="checkpoint-footer"><button type="button" :disabled="readonly" @click="submitChapterRetell(chapter)">保存复述为待复核</button><strong>{{ chapterStatusLabel(chapter) }}</strong></div></div>
            </section>
          </div>
        </main>

        <aside class="w1-route" aria-label="W4D3 七章学习路线"><div class="w1-route-head"><strong>七章学习路线</strong><span>{{ progressPercent }}%</span></div><div v-for="session in [1, 2]" :key="session" class="w1-route-group"><strong><span>时段 {{ session }}</span><span>{{ plan.chapters.filter((chapter) => chapter.session === session).length }} 章</span></strong><div class="w1-route-list"><button v-for="chapter in plan.chapters.filter((item) => item.session === session)" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></div></div><div class="w1-route-note"><strong>掌握未判定 · {{ progressPercent }}%</strong><br>当前位置与完成状态分开；清空重做立即撤销对应高亮。</div></aside>
      </div>
    </div>
  </article>
</template>

<style scoped src="./W11D1Day01CourseView.css"></style>
