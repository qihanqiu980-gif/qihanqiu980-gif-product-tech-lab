<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyExerciseEvidence, DailyLessonEvidenceState, LessonConsoleEntry, PrerequisiteDecision } from './DailyLessonView.vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import type { Day01ChapterId, Day01FrameworkChapter } from '../course/day01Framework'
import { getW4D1FrameworkPlan } from '../course/w4d1Framework'
import { countSubstantiveContribution } from '../course/evidenceQuality'
import { assessChapterRetell, buildRetellReferenceAnswer } from '../course/retellAssessment'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<infer U> ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }
type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'
type MetricScenario =
  | 'purpose-missing'
  | 'signal-missing'
  | 'numerator-only'
  | 'denominator-missing'
  | 'grain-ambiguous'
  | 'time-window-ambiguous'
  | 'exclusion-missing'
  | 'qualified-metric-contract'

interface ChapterEvidence {
  learn: boolean
  selectedIndex: number | null
  practicePassed: boolean
  retell: string
  retellSubmitted: boolean
  retellAttempts: number
}

type W4D1Evidence = DailyLessonEvidenceState & {
  contentVersion: string
  frameworkChapters: Record<Day01ChapterId, ChapterEvidence>
}

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<W4D1Evidence>
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
  const resolved = getW4D1FrameworkPlan(props.lesson.id)
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

function blankEvidence(): W4D1Evidence {
  return {
    schemaVersion: 2,
    lessonId: props.lesson.id,
    contentVersion: props.lesson.contentVersion,
    prerequisiteDecisions: Object.fromEntries(props.lesson.prerequisites.map((item) => [item.id, '' as PrerequisiteDecision])),
    visitedConceptIds: [], expandedConceptIds: [], completedSections: [],
    sandbox: { activePanel: 'elements', previewHeadline: '指标口径定义练习台', domDraft: '', domEdits: 0, ageInput: 'purpose-missing', buttonState: 'idle', buttonClicks: 0, consoleHistory: [] },
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

function mergeEvidence(source?: DeepPartial<W4D1Evidence>): W4D1Evidence {
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

const evidence = ref<W4D1Evidence>(mergeEvidence(props.evidenceState))
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

function cloneEvidence(): W4D1Evidence { return JSON.parse(JSON.stringify(evidence.value)) as W4D1Evidence }
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
  { metric_id: 'app_paid_order_count', decision_purpose: '复核 app 渠道支付订单规模', signal: '规模信号', numerator: 'status=paid AND channel=app AND is_test=0', denominator: '不适用', grain: 'order_id' },
  { metric_id: 'app_payment_conversion_rate', decision_purpose: '复核 app 支付链路是否需要排查', signal: '转化信号', numerator: 'app paid 订单', denominator: 'app 支付尝试对象', grain: 'user_id or order_id' },
] as const

const firstCompleteMetric = {
  metric_id: 'app_paid_order_count',
  decision_purpose: '判断 2026-08-31 app 渠道支付订单规模是否需要进一步复核。',
  signal: 'app 渠道符合口径的支付订单规模信号，不能单独解释原因。',
  numerator: 'status=paid AND channel=app AND is_test=0 的订单。',
  denominator: '不适用；这是计数指标，不是转化率。',
  grain: 'order_id；重复 order_id 先标记，计算前确认去重规则。',
  time_window: '2026-08-31 00:00:00 <= paid_at < 2026-09-01 00:00:00，业务时区待确认。',
  exclusion_rules: '排除 is_test=1；refunded/cancelled 不计入 paid；NULL paid_at 不进入本指标。',
  quality_risks: 'O1018 重复、NULL paid_amount、O1014 跨天边界需复核。',
  source_query_ref: 'W3D6 BQ01/BQ02/BQ12',
  can_prove: '能证明这条指标口径字段完整，可交给 W4D2 学习聚合计算。',
  cannot_prove: '不能证明真实生产订单数、收入、指标正确、原因、GROUP BY/JOIN 已完成或 W4D2 已完成。',
  next_sql_task: 'W4D2 再按该口径学习 COUNT、DISTINCT 和 GROUP BY。',
} as const

const metricTasks = [
  {
    id: 'purpose-missing',
    label: '目的缺失',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '只有“app 支付率”这个名字，没有说明它要支持什么决策。',
    sql: 'decision_purpose: __missing__',
    expected: '先写清楚要判断什么、谁会用、会做什么动作。',
    actual: '只剩一个名字，无法指导分子和分母。',
    field: 'decision_purpose',
    metric: 'purpose missing',
    conclusion: 'purpose_must_precede_formula',
    action: '先补决策目的，再谈公式和口径。',
    canProve: '能证明没有决策目的时，指标只剩名称。',
    cannotProve: '不能证明指标已经定义完成。',
    deliverableHint: '补 decision_purpose、signal 和 next_sql_task。',
  },
  {
    id: 'signal-missing',
    label: '信号缺失',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '只说 app 支付率下降，没有说明这个变化代表什么。',
    sql: 'signal: __missing__',
    expected: '写出这条指标变化反映的有限业务现象。',
    actual: '无法判断是规模、转化还是质量边界问题。',
    field: 'signal',
    metric: 'signal missing',
    conclusion: 'signal_limits_interpretation',
    action: '补 signal 和 signal_limit，不能直接写成因果结论。',
    canProve: '能证明没有信号边界时，数字无法独立解释。',
    cannotProve: '不能证明原因、效果或结论成立。',
    deliverableHint: '补 signal、signal_limit 和 cannot_prove。',
  },
  {
    id: 'numerator-only',
    label: '只有分子',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '已经写了 paid app 订单，但没有说明哪些行算达成集合。',
    sql: 'numerator: status=paid AND channel=app AND is_test=0',
    expected: '说明进入达成集合的条件。',
    actual: '分子有了，但口径还不完整。',
    field: 'numerator',
    metric: 'numerator defined',
    conclusion: 'numerator_needs_context',
    action: '补分子之外的分母、粒度、时间窗口和排除规则。',
    canProve: '能证明达成集合需要完整上下文。',
    cannotProve: '不能证明是转化率或最终指标。',
    deliverableHint: '补 numerator 与 source_query_ref。',
  },
  {
    id: 'denominator-missing',
    label: '分母缺失',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '要做“支付转化率”，但还没有分母。',
    sql: 'denominator: __missing__',
    expected: '写出有机会达成的对象集合。',
    actual: '没有分母就不是转化率。',
    field: 'denominator',
    metric: 'denominator missing',
    conclusion: 'ratio_requires_opportunity_set',
    action: '把机会集合写出来，再考虑后续计算。',
    canProve: '能证明比例指标一定要有分母。',
    cannotProve: '不能证明可以直接算转化率。',
    deliverableHint: '补 denominator 或说明不适用原因。',
  },
  {
    id: 'grain-ambiguous',
    label: '粒度不清',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '同一指标到底按订单、用户还是会话计数没有说清。',
    sql: 'grain: __ambiguous__',
    expected: '写清去重键和计数对象。',
    actual: 'order_id、user_id 和 session_id 混在一起。',
    field: 'grain',
    metric: 'grain ambiguous',
    conclusion: 'grain_changes_metric_meaning',
    action: '先定 grain，再谈去重或 DISTINCT。',
    canProve: '能证明粒度不清会改变指标含义。',
    cannotProve: '不能证明已有可计算口径。',
    deliverableHint: '补 grain、dedupe_rule 和 quality_risks。',
  },
  {
    id: 'time-window-ambiguous',
    label: '时间模糊',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '只写“8 月 31 日全天”，没有写起止和业务时区。',
    sql: 'time_window: __ambiguous__',
    expected: '闭开时间边界和时区假设。',
    actual: 'O1014 这类 0 点边界行会被误归类。',
    field: 'time_window',
    metric: 'time window ambiguous',
    conclusion: 'boundary_needs_contract',
    action: '补闭开边界和待确认的业务日规则。',
    canProve: '能证明边界行会影响指标。',
    cannotProve: '不能证明真实业务日归属。',
    deliverableHint: '补 time_window、boundary_cases 和 review_question。',
  },
  {
    id: 'exclusion-missing',
    label: '排除缺失',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: 'TEST1、O1018、NULL、0 元和退款是否排除没有写清。',
    sql: 'exclusion_rules: __missing__',
    expected: '写清测试、重复、NULL 和异常金额如何处理。',
    actual: '质量问题会混入后续计算。',
    field: 'exclusion_rules',
    metric: 'exclusion missing',
    conclusion: 'quality_rules_before_calculation',
    action: '把质量风险放在计算前。',
    canProve: '能证明排除规则是指标口径的一部分。',
    cannotProve: '不能证明数据已清洗。',
    deliverableHint: '补 exclusion_rules、quality_risks、cannot_prove。',
  },
  {
    id: 'qualified-metric-contract',
    label: '合格口径',
    target: 'metric-contract-table.md + review note',
    mode: '教学模拟',
    businessQuestion: '把 W3D6 的行级证据收束成一条可复核的指标口径。',
    sql: 'SELECT metric_id, decision_purpose, signal, numerator, denominator, grain, time_window, exclusion_rules FROM metric_contract_table;',
    expected: '字段齐全，风险写清，下一步只进入 W4D2。',
    actual: 'app_paid_order_count 与 app_payment_conversion_rate 均可写成口径草稿。',
    field: 'next_sql_task',
    metric: 'qualified metric contract',
    conclusion: 'contract_ready_for_w4d2',
    action: '把完整口径交给 W4D2 计算，不在本日算数。',
    canProve: '能证明口径定义完整可复核。',
    cannotProve: '不能证明真实生产指标、原因、GROUP BY、JOIN 或 W4D2 已完成。',
    deliverableHint: '补 source_query_ref、can_prove、cannot_prove 和 next_sql_task。',
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
  return metricScenarioValues.includes(value as MetricScenario) ? value as MetricScenario : 'purpose-missing'
})
const currentMetricRun = computed(() => {
  const scenario = currentMetricScenario.value
  const task = metricTasks.find((item) => item.id === scenario) ?? metricTasks[0]
  return { ...task, evidenceLimit: '只能证明本地教学模拟中的指标口径字段可复核，不能证明真实生产数据、聚合、GROUP BY、JOIN、业务指标正确或 W4D2 已完成' }
})
const metricCoverage = computed(() => {
  const commands = evidence.value.sandbox.consoleHistory.map((entry) => entry.command)
  return Object.fromEntries(metricTasks.map((task) => [task.id, commands.some((item) => item.includes(task.id))])) as Record<MetricScenario, boolean>
})
function runMetricObserver() {
  const run = currentMetricRun.value; evidence.value.sandbox.buttonClicks += 1
  const runId = `w4d1-metric-${String(evidence.value.sandbox.buttonClicks).padStart(3, '0')}`
  evidence.value.sandbox.consoleHistory.push({ command: `${runId}|${currentMetricScenario.value}`, output: `${run.field} → ${run.conclusion}`, tone: 'normal' })
  evidence.value.guidedLab.observations['latest-metric-run'] = `${runId} · ${run.label} · field=${run.field} · conclusion=${run.conclusion}`
  announcement.value = `已追加 ${runId}；这是本地教学模拟，只形成指标口径定义证据，不证明真实生产数据、聚合、GROUP BY、JOIN、业务指标正确或 W4D2 已完成。`; publish()
}
function resetMetricObserver() {
  const blank = blankEvidence(); evidence.value.sandbox = blank.sandbox; evidence.value.guidedLab = blank.guidedLab
  setSectionComplete('guided-lab', false); announcement.value = '指标口径观察器与当前草稿已清空；历史正式尝试未删除。'; publish()
}
function completeGuidedLab() {
  const stepsReady = guidedSteps.value.every(({ index }) => evidence.value.guidedLab.stepComplete[String(index)])
  const recordsReady = guidedRecords.value.every(({ index }) => (evidence.value.guidedLab.records[String(index)] || '').trim().length >= 8)
  const checksReady = props.lesson.guidedLab.passCriteria.every((_, index) => evidence.value.guidedLab.passChecks[String(index)])
  if (evidence.value.guidedLab.prediction.trim().length < 12 || !Object.values(metricCoverage.value).every(Boolean) || !stepsReady || !recordsReady || !checksReady) { announcement.value = '先完成预测、8 条指标口径路径、引导步骤、记录与通过标准。'; return }
  setSectionComplete('guided-lab', true); saveAttempt('guided-lab'); announcement.value = '指标口径实操证据已追加保存；它只证明本地教学模拟中的口径字段可复核。'
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
const validationFields = ['metric_id', 'decision_purpose', 'signal', 'numerator', 'denominator', 'grain', 'time_window', 'exclusion_rules', 'quality_risks', 'source_query_ref', 'can_prove', 'cannot_prove', 'next_sql_task'] as const
const deliverableGate = computed(() => {
  const text = evidence.value.deliverable.draft
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const errors: string[] = []
  const fieldPresence = Object.fromEntries(validationFields.map((field) => [field, lower.includes(field)])) as Record<(typeof validationFields)[number], boolean>
  for (const field of validationFields) if (!fieldPresence[field]) errors.push(`缺少字段：${field}。`)
  const requiredBoundaryPhrases = ['教学模拟', '不能证明', 'W4D2', 'decision_purpose', 'numerator', 'denominator', 'grain', 'time_window', 'TEST1', 'O1018', 'NULL']
  for (const phrase of requiredBoundaryPhrases) if (!text.includes(phrase)) errors.push(`必须写明边界或下一步：${phrase}。`)
  const forbiddenClaims = [
    ['真实生产', '已证明'], ['业务指标', '正确'], ['指标', '已经正确'], ['JOIN', '已完成'], ['GROUP BY', '已完成'], ['聚合', '已完成'],
    ['W4D1', '已完成'],
  ]
  for (const [subject, claim] of forbiddenClaims) {
    if (text.includes(subject) && text.includes(claim)) errors.push(`不得越界声明：${subject}${claim}。`)
  }
  const questionReady = /business_question[\s\S]{0,260}(订单|orders|查询|样本|SELECT)/i.test(text)
  const tableReady = /base_table[\s\S]{0,160}orders/i.test(text)
  const metricIdReady = /metric_id[\s\S]{0,220}(app|paid|conversion|count|rate)/i.test(text)
  const purposeReady = /decision_purpose[\s\S]{0,360}(判断|复核|决策|排查|取舍)/i.test(text)
  const signalReady = /signal[\s\S]{0,360}(信号|规模|转化|不能单独解释|边界)/i.test(text)
  const numeratorReady = /numerator[\s\S]{0,520}(paid|status|app|达成|订单)/i.test(text)
  const denominatorReady = /denominator[\s\S]{0,520}(不适用|机会|尝试|分母|用户|订单)/i.test(text)
  const grainReady = /grain[\s\S]{0,360}(order_id|user_id|去重|订单|用户)/i.test(text)
  const timeReady = /time_window[\s\S]{0,420}(2026-08-31|2026-09-01|<=|<|业务日|时区)/i.test(text)
  const exclusionReady = /exclusion_rules[\s\S]{0,520}(TEST1|is_test|refunded|cancelled|NULL|排除)/i.test(text)
  const risksReady = /quality_risks[\s\S]{0,520}(O1018|TEST1|NULL|O1014|0 元|边界)/i.test(text)
  const sourceReady = /source_query_ref[\s\S]{0,260}(W3D6|BQ01|BQ12|业务查询集)/i.test(text)
  const canReady = /can_prove[\s\S]{0,420}(能证明|口径|字段完整|定义|可复核)/i.test(text)
  const cannotReady = /cannot_prove[\s\S]{0,700}(不能证明|真实生产|聚合|GROUP BY|JOIN|指标正确|收入|原因|W4D2)/i.test(text)
  const nextReady = /next_sql_task[\s\S]{0,360}(W4D2|COUNT|DISTINCT|GROUP BY|聚合)/i.test(text)
  if (!metricIdReady) errors.push('metric_id 必须写出指标编号。')
  if (!purposeReady) errors.push('decision_purpose 必须写出决策目的。')
  if (!signalReady) errors.push('signal 必须写出有限业务信号。')
  if (!numeratorReady) errors.push('numerator 必须写出分子达成集合。')
  if (!denominatorReady) errors.push('denominator 必须写出分母或不适用原因。')
  if (!grainReady) errors.push('grain 必须写出统计粒度和去重键。')
  if (!timeReady) errors.push('time_window 必须写出闭开时间窗口。')
  if (!exclusionReady) errors.push('exclusion_rules 必须写出排除规则。')
  if (!risksReady) errors.push('quality_risks 必须标注 W3 质量风险。')
  if (!sourceReady) errors.push('source_query_ref 必须追溯 W3D6 查询记录。')
  if (!canReady) errors.push('can_prove 必须限定到口径定义完整。')
  if (!cannotReady) errors.push('cannot_prove 必须写出真实生产、聚合、GROUP BY、JOIN、指标或 W4D2 边界。')
  if (!nextReady) errors.push('next_sql_task 必须指向 W4D2 聚合计算。')
  return { valid: errors.length === 0, errors, lineCount: lines.length, fieldPresence, presentFields: validationFields.filter((field) => fieldPresence[field]).length }
})
const deliverableFieldStatus = computed(() => validationFields.map((field) => ({ field, done: deliverableGate.value.fieldPresence[field] })))
function completeDeliverable() {
  const checksReady = checklistSet.value.every(({ index }) => evidence.value.deliverable.checklist[String(index)])
  if (deliverableContribution.value < activePath.value.deliverableMinimumContributionCharacters || !checksReady || !deliverableGate.value.valid) { announcement.value = `成果需要至少 ${activePath.value.deliverableMinimumContributionCharacters} 个有效实写字符、完成自检，并通过指标口径字段门禁。`; return }
  setSectionComplete('deliverable', true); saveAttempt('deliverable'); announcement.value = '指标口径表已作为待审核成果追加保存；真实生产数据、聚合、GROUP BY、JOIN 和业务指标仍未判定。'
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
      <header class="w1-appbar"><button type="button" class="w1-brand" @click="emit('navigate', 'today')"><span class="w1-brand-mark">PL</span><strong>产品技术实验室</strong></button><span class="w1-appbar-meta">COURSE / W4D1</span></header>
      <div class="w1-shell">
        <main class="w1-main">
          <header class="course-cover">
            <div><p class="eyebrow">WEEK 4 · DAY 1 · 双时段课程</p><h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1><p class="subtitle">{{ lesson.subtitle }}</p></div>
            <div class="cover-summary" aria-label="课程时间与进度"><div class="cover-summary-head"><strong>{{ visibleCourseMinutes }} 分钟</strong><span>建议分两次完成</span></div><div class="cover-progress"><i :style="{ width: `${progressPercent}%` }"></i></div><div class="cover-summary-labels"><span>本次专注 {{ durationMode }} 分钟</span><span>两时段 · 七章</span></div><div class="cover-evidence"><span>已学习 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].learn).length }}/7</span><span>练习通过 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].practicePassed).length }}/7</span><span>待复核复述 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].retellSubmitted).length }}/7</span><span>掌握未判定</span></div></div>
          </header>
          <section class="session-strip" aria-label="两个学习时段"><div class="session-card"><strong>第一时段 · {{ sessionOneMinutes }} 分钟</strong><span>{{ sessionOneTitles }}</span></div><div class="session-card"><strong>第二时段 · {{ sessionTwoMinutes }} 分钟</strong><span>{{ sessionTwoTitles }}</span></div></section>
          <details ref="mobileRoute" class="w1-mobile-route"><summary>章节目录 · {{ plan.chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1 }} / 7 {{ plan.chapters.find((chapter) => chapter.id === activeChapterId)?.title }}</summary><nav class="w1-route-list" aria-label="W4D1 移动端七章目录"><button v-for="chapter in plan.chapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></nav></details>
          <div class="course-protocol"><span>指标不是一个数字</span><p>本课只用 W3D6 的本地教学查询记录建立 `metric-contract-table.md`：先写 decision_purpose、signal、numerator、denominator、grain、time_window、exclusion_rules、quality_risks、can_prove、cannot_prove 和 next_sql_task。不连接真实数据库、不读取公司数据，也不把口径定义写成聚合、GROUP BY、JOIN、真实生产指标正确或 W4D2 已完成。前置不足只提示补学，不锁全文。</p></div>
          <p v-if="announcement" class="announcement" role="status" aria-live="polite">{{ announcement }}</p>

          <div class="manuscript">
            <section v-for="chapter in plan.chapters" :id="`${lesson.id.toLowerCase()}-${chapter.id}`" :key="chapter.id" class="framework-chapter" :data-framework-chapter="chapter.id" tabindex="-1">
              <header class="chapter-head"><div><span>SESSION {{ String(chapter.session).padStart(2, '0') }} · CHAPTER {{ String(chapter.number).padStart(2, '0') }}</span><h2>{{ chapter.title }}</h2><p>{{ chapter.lead }}</p></div><strong>{{ chapter.timeMinutes }} MIN</strong></header>

              <template v-if="chapter.number === 1">
                <div class="scenario-copy"><p><b>你的角色</b>{{ lesson.scenario.role }}</p><p><b>发生了什么</b>{{ lesson.scenario.situation }}</p><blockquote>{{ lesson.scenario.question }}</blockquote><p><b>为什么重要</b>{{ lesson.scenario.stakes }}</p></div>
                <div class="plain-section">
                  <h3>今天先看见对象：指标口径表</h3>
                  <p>今天学的是指标定义。先不要写 COUNT、SUM、GROUP BY 或 JOIN，先确认一个指标必须服务决策、表达信号，并写清分子、分母、粒度、时间窗口和排除规则。</p>
	                  <div class="system-console" aria-label="指标口径样本">
	                    <p class="simulation-label">来自 W3D6 本地教学记录的指标口径样本</p>
	                    <table>
                      <thead><tr><th>metric_id</th><th>decision_purpose</th><th>signal</th><th>numerator</th><th>denominator</th><th>grain</th></tr></thead>
                      <tbody>
                        <tr v-for="row in metricSampleRows" :key="row.metric_id">
                          <td>{{ row.metric_id }}</td><td>{{ row.decision_purpose }}</td><td>{{ row.signal }}</td><td>{{ row.numerator }}</td><td>{{ row.denominator }}</td><td>{{ row.grain }}</td>
                        </tr>
                      </tbody>
	                    </table>
	                  </div>
	                </div>
	                <div class="plain-section">
	                  <h3>先跑一条完整查询，再拆概念</h3>
                  <p>先看一条能从头到尾解释的指标口径，再进入 decision_purpose、signal、numerator、denominator、grain、time_window 和 exclusion_rules。这样学习者先知道“今天到底在定义什么”，再把字段拆开。</p>
	                  <dl class="stage-ledger">
	                    <div><dt>决策目的</dt><dd>{{ firstCompleteMetric.decision_purpose }}</dd></div>
	                    <div><dt>信号</dt><dd>{{ firstCompleteMetric.signal }}</dd></div>
	                    <div><dt>分子</dt><dd>{{ firstCompleteMetric.numerator }}</dd></div>
	                    <div><dt>分母</dt><dd>{{ firstCompleteMetric.denominator }}</dd></div>
	                    <div><dt>粒度</dt><dd>{{ firstCompleteMetric.grain }}</dd></div>
	                    <div><dt>时间窗口</dt><dd>{{ firstCompleteMetric.time_window }}</dd></div>
	                    <div><dt>排除规则</dt><dd>{{ firstCompleteMetric.exclusion_rules }}</dd></div>
	                    <div><dt>不能证明什么</dt><dd>{{ firstCompleteMetric.cannot_prove }}</dd></div>
	                  </dl>
	                </div>
	                <div class="plain-section"><h3>学完后要交出的证据</h3><ol class="objective-list"><li v-for="objective in lesson.objectives" :key="objective.id"><strong>{{ objective.text }}</strong><span>{{ objective.evidence }}</span></li></ol></div>
	                <div class="prerequisite-panel"><div><h3>跨阶段提前观看：提醒，不锁全文</h3><p>即使 W1/W2 或前一日未完成，也可从路线或深链直接阅读完整 W4D1。当前只检查本机终端和本地教学目录准备度；缺口只限制 `business-query-log.md` 的实操结论，不隐藏课程。</p></div><fieldset v-for="item in lesson.prerequisites" :key="item.id"><legend>{{ item.prompt }}</legend><p>{{ item.passDescription }}</p><div class="decision-row"><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="pass" :disabled="readonly" @change="updatePrerequisite">已能独立做到</label><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="remediate" :disabled="readonly" @change="updatePrerequisite">需要先补学</label></div><div v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'" class="remediation"><b>{{ item.remediationLabel }}</b><ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol><a :href="item.remediationTarget">打开补学课程</a></div></fieldset></div>
              </template>

              <div v-if="chapter.number === 2 || chapter.number === 3" class="concept-ledger"><article v-for="concept in conceptsFor(chapter)" :id="`concept-${concept.id}`" :key="concept.id"><header><div><small>{{ concept.english }}</small><h3>{{ concept.term }}</h3></div><span>{{ concept.systemPosition }}</span></header><p class="concept-definition">{{ concept.definition }}</p><div class="concept-why"><p><b>为什么需要它</b>{{ concept.why }}</p><p><b>解决什么问题</b>{{ concept.problemSolved }}</p></div><dl><div><dt>输入</dt><dd>{{ concept.input }}</dd></div><div><dt>输出</dt><dd>{{ concept.output }}</dd></div><div><dt>责任人</dt><dd>{{ concept.owner }}</dd></div><div><dt>不负责</dt><dd>{{ concept.notResponsibleFor }}</dd></div><div><dt>与相邻层比较</dt><dd>{{ concept.compareWith }}</dd></div><div><dt>可观察证据</dt><dd>{{ concept.evidence.join('；') }}</dd></div></dl><ol class="concept-process"><li v-for="step in concept.process" :key="step">{{ step }}</li></ol><p class="pm-use"><b>产品经理怎样用：</b>{{ concept.pmUse }}</p><div class="example-pair"><div><b>正确例子</b>{{ concept.correctExample }}</div><div><b>越界例子</b>{{ concept.incorrectExample }}</div></div></article></div>

              <div v-if="chapter.number === 4" class="understanding-map"><span>query_id</span><i>→</i><span>request_ref</span><i>→</i><span>sql_text</span><i>→</i><span>expected_rows</span><i>→</i><span>observed_result</span><i>→</i><span>quality_flags</span><i>→</i><span>handoff_note</span><p>先把每条业务问题绑定到 W3D5 的取数口径，再用 orders 单表 SQL 得到行级观察，随后把 TEST1、O1018、NULL、0 元和日期边界写进 quality_flags。最后用 can_prove、cannot_prove、handoff_note 和 next_review_question 说明这条结果能如何交接，以及 W4D1 还要定义哪些指标口径。</p></div>

              <template v-if="chapter.number === 5">
                <figure class="relationship-map"><figcaption><strong>{{ lesson.diagram.title }}</strong><span>{{ lesson.diagram.caption }}</span></figcaption><ol><li v-for="node in lesson.diagram.nodes" :key="node.id"><strong>{{ node.label }}</strong><p>{{ node.description }}</p><small>输入：{{ node.input }} · 输出：{{ node.output }}</small></li></ol><ul><li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind"><span>{{ branch.from }}</span><i>→</i><b>{{ branch.label }}</b><i>→</i><span>{{ branch.to }}</span></li></ul><div><b>读图时找这些证据</b><p v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</p></div></figure>
                <div class="demonstration"><h3>{{ lesson.demonstration.title }}</h3><p><b>业务问题：</b>{{ lesson.demonstration.businessProblem }}</p><ol><li v-for="(step, index) in lesson.demonstration.steps" :key="step.title"><span>{{ index + 1 }}</span><div><h4>{{ step.title }}</h4><p><b>教师操作：</b>{{ step.action }}</p><p><b>为什么：</b>{{ step.reason }}</p><p><b>看到：</b>{{ step.evidence }}</p><p><b>能证明：</b>{{ step.proves }}</p><p><b>不能证明：</b>{{ step.limitation }}</p></div></li></ol><div id="demonstration-conclusion" class="limited-conclusion"><p><b>有限结论：</b>{{ lesson.demonstration.finalConclusion }}</p><p><b>结论限制：</b>{{ lesson.demonstration.conclusionLimit }}</p></div></div>
                <div class="lab-panel">
                  <div class="lab-title"><div><span>教学模拟</span><h3>{{ lesson.guidedLab.title }}</h3><p>{{ lesson.guidedLab.goal }}</p></div><small>{{ lesson.guidedLab.safety }}</small></div>
                  <label class="field"><span>先预测</span><small>{{ lesson.guidedLab.predictionPrompt }}</small><textarea v-model="evidence.guidedLab.prediction" rows="3" :readonly="readonly" aria-label="指标口径 实验预测" @input="publish" /></label>
                  <div class="system-console">
                    <p class="simulation-label">教学模拟 · 只读取 W3D6 本地指标口径素材，不调用真实数据库、账号、Token、公司数据或生产系统</p>
                    <label><span>选择一道指标口径路径</span><select v-model="evidence.sandbox.ageInput" :disabled="readonly" aria-label="指标口径 教学场景" @change="publish"><option v-for="task in metricTasks" :key="task.id" :value="task.id">{{ task.label }}</option></select></label>
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
                    <ol v-if="evidence.sandbox.consoleHistory.length" class="exchange-history" aria-label="指标口径 教学模拟追加历史"><li v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${entry.command}-${index}`"><code>{{ entry.command }}</code><span>{{ entry.output }}</span></li></ol>
                    <div class="simulation-coverage" aria-label="指标口径 实验覆盖"><span v-for="task in metricTasks" :key="task.id" :class="{ done: metricCoverage[task.id] }">{{ task.label }}</span></div>
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
                <div class="boundary-table"><h3>先修常见误判</h3><dl><div><dt>问题太模糊</dt><dd>“查订单”不能执行。先补 query_id 和 business_question，确认问题能落到 orders 字段。</dd></div><div><dt>日期只写等于</dt><dd>paid_at 带小时分钟，应用 paid_at >= 起点 AND paid_at < 下一天起点。</dd></div><div><dt>文本值没引号</dt><dd>channel = app 会被误读；文本值要写成 channel = "app"。</dd></div><div><dt>没排序说最新</dt><dd>没有 ORDER BY paid_at DESC，不能说第一行就是最新。</dd></div><div><dt>别名无意义</dt><dd>paid_at AS x 不利于交接；改成 paid_time，并记录 AS 不修改表结构。</dd></div><div><dt>DISTINCT 越界</dt><dd>SELECT DISTINCT channel 只展示 app、miniapp、web，不等于渠道订单数或指标口径。</dd></div></dl></div>
                <div class="independent-panel"><h3>{{ lesson.independentLab.title }}</h3><p>{{ lesson.independentLab.scenario }}</p><label><span>改变一个条件</span><select v-model="evidence.independentLab.changedCondition" :disabled="readonly" @change="publish"><option value="">请选择</option><option v-for="item in lesson.independentLab.changedConditions" :key="item" :value="item">{{ item }}</option></select></label><label><span>先预测</span><small>{{ lesson.independentLab.predictionPrompt }}</small><textarea v-model="evidence.independentLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label><label><span>检查计划</span><textarea v-model="evidence.independentLab.plan" rows="5" :readonly="readonly" aria-label="指标口径记录 检查计划" @input="publish" /></label><label><span>命令与证据</span><textarea v-model="evidence.independentLab.evidence" rows="5" :readonly="readonly" aria-label="指标口径记录 命令证据" @input="publish" /></label><label><span>观察结果</span><textarea v-model="evidence.independentLab.result" rows="3" :readonly="readonly" aria-label="指标口径记录 观察结果" @input="publish" /></label><label><span>四句有限结论</span><textarea v-model="evidence.independentLab.conclusion" rows="4" :readonly="readonly" aria-label="指标口径记录 有限结论" @input="publish" /></label><div class="check-list"><label v-for="(item, index) in lesson.independentLab.passCriteria" :key="item"><input v-model="evidence.independentLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeIndependentLab">保存独立变式尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetIndependentLab">清空并重做</button></div></div>
              </template>

              <template v-if="chapter.number === 7">
                <div class="practice-workshop"><h3>针对性练习</h3><p>先作答，再看逐项解释；WHERE、日期边界、ORDER BY、AS 和 DISTINCT 不能混写，更不能提前声称数据质量、聚合、GROUP BY、JOIN 或真实业务指标正确。</p><article v-for="(exercise, index) in exerciseSet" :key="exercise.id"><header><span>{{ index + 1 }}</span><div><h4>{{ exercise.prompt }}</h4><small>{{ exercise.categories.join(' · ') }}</small></div></header><div class="answer-options"><label v-for="(option, optionIndex) in exercise.options" :key="option.label"><input v-model="exerciseState(exercise).selectedIndex" type="radio" :name="exercise.id" :value="optionIndex" :disabled="readonly || exerciseState(exercise).submitted" @change="publish"><span>{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option.label }}</label></div><div v-if="exerciseState(exercise).submitted" :class="['exercise-feedback', exerciseState(exercise).selfAssessment]"><b>{{ exerciseState(exercise).selfAssessment === 'pass' ? '当前通过' : '对照后修正' }}</b><p>{{ exercise.referenceAnswer }}</p><ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol><p><b>逐项解释：</b>{{ exercise.options?.map((option) => `${option.label}：${option.rationale}；${option.couldBeTrueWhen}`).join('；') }}</p><p><b>常见错因：</b>{{ exercise.commonErrors.map((item) => `${item.error}：${item.reason}`).join('；') }}</p></div><div class="panel-actions"><button v-if="!exerciseState(exercise).submitted" type="button" :disabled="readonly" @click="submitExercise(exercise)">提交本题</button><button type="button" class="secondary" :disabled="readonly" @click="resetExercise(exercise)">清空并重做</button></div></article></div>
	                <div class="deliverable-panel"><h3>{{ lesson.deliverable.title }}</h3><p>{{ lesson.deliverable.purpose }}</p><p>不要先面对整张验收清单。先按口径字段逐项生成记录：先写 metric_id 和 decision_purpose，再补 signal、numerator、denominator、grain、time_window、exclusion_rules、quality_risks、source_query_ref、can_prove、cannot_prove 和 next_sql_task。</p><div class="field-ledger"><div><b>第 1 步：指标身份</b><p>metric_id、decision_purpose。</p><small>例：app_paid_order_count；判断 app 渠道支付订单规模是否需要进一步复核。</small></div><div><b>第 2 步：信号与公式</b><p>signal、numerator、denominator。</p><small>本日只定义口径，不写 COUNT、SUM、GROUP BY 或 JOIN。</small></div><div><b>第 3 步：粒度与边界</b><p>grain、time_window、exclusion_rules、quality_risks。</p><small>先写分子分母，再写 TEST1、O1018、NULL、0 元和日期边界。</small></div><div><b>第 4 步：交接边界</b><p>source_query_ref、can_prove、cannot_prove、next_sql_task。</p><small>每条都要承认不能证明真实生产、指标正确、GROUP BY、JOIN 或 W4D2 已完成。</small></div></div><details open><summary>每条口径完成后该补哪些成果字段</summary><ol><li v-for="item in lesson.deliverable.fields" :key="item.name"><b>{{ item.name }}：</b>{{ item.meaning }}；来源：{{ item.source }}</li></ol></details><div class="field-ledger"><div v-for="field in lesson.deliverable.fields" :key="field.name"><b>{{ field.name }}</b><p>{{ field.meaning }}</p><small>证据来源：{{ field.source }}</small></div></div><details><summary>先看一份差稿怎样修正</summary><blockquote>{{ lesson.deliverable.badExample }}</blockquote><p><b>差稿问题：</b>{{ lesson.deliverable.badReasons.join('；') }}</p><ol><li v-for="item in lesson.deliverable.revisionSteps" :key="item">{{ item }}</li></ol><pre>{{ lesson.deliverable.goodExample }}</pre></details><div class="template-actions"><button type="button" :disabled="readonly" @click="useDeliverableTemplate('guided')">使用引导模板</button><button type="button" class="secondary" :disabled="readonly" @click="useDeliverableTemplate('blank')">使用空白模板</button></div><textarea v-model="evidence.deliverable.draft" rows="18" spellcheck="false" :readonly="readonly" :aria-label="`${lesson.deliverable.title} Markdown 草稿`" @input="evidence.deliverable.touched = true; setSectionComplete('deliverable', false); publish()" /><p class="counter">有效实写 {{ deliverableContribution }} / {{ activePath.deliverableMinimumContributionCharacters }} 字符 · 逐题记录字段 {{ deliverableGate.presentFields }}/13 · 非空行 {{ deliverableGate.lineCount }} · 边界门禁 {{ deliverableGate.valid ? '通过' : '待修复' }}</p><div class="simulation-coverage" aria-label="指标口径 逐题字段配额"><span v-for="item in deliverableFieldStatus" :key="item.field" :class="{ done: item.done }">{{ item.field }}</span><span :class="{ done: deliverableGate.valid }">{{ deliverableGate.valid ? '指标口径 valid' : '指标口径 待修复' }}</span></div><details v-if="deliverableGate.errors.length" class="remediation"><summary>查看指标口径门禁错误（{{ deliverableGate.errors.length }}）</summary><ol><li v-for="error in deliverableGate.errors" :key="error">{{ error }}</li></ol></details><div class="check-list"><label v-for="item in checklistSet" :key="item.index"><input v-model="evidence.deliverable.checklist[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item.item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeDeliverable">校验并保存完整指标口径表</button><button type="button" class="secondary" :disabled="readonly" @click="resetDeliverable">清空并重做</button></div></div>
                <div class="memory-panel"><h3>最终复述与复习排程</h3><div class="check-list"><label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor"><input v-model="evidence.memory.anchorChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ anchor }}</label></div><label><span>闭卷解释</span><small>{{ lesson.memory.closedBookPrompt }}</small><textarea v-model="evidence.memory.closedBook" rows="6" :readonly="readonly" aria-label="W4D1 最终闭卷解释" @input="publish" /></label><label><span>微操作</span><small>{{ lesson.memory.microOperation }}</small><textarea v-model="evidence.memory.microOperation" rows="3" :readonly="readonly" aria-label="W4D1 记忆微操作" @input="publish" /></label><label><span>仍未解决的问题</span><small>{{ lesson.memory.unresolvedPrompt }}</small><textarea v-model="evidence.memory.unresolved" rows="3" :readonly="readonly" aria-label="W4D1 未解决问题" @input="publish" /></label><div class="review-timeline"><label v-for="(stage, index) in lesson.memory.reviewStages" :key="stage.stage"><input v-model="evidence.memory.reviewChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish"><b>{{ stage.stage }}</b><span>{{ stage.task }}</span></label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeMemory">保存最终复述与复习计划</button><button type="button" class="secondary" :disabled="readonly" @click="resetMemory">清空并重做</button></div></div>
                <div class="course-completion"><h3>完成核验</h3><p>完成页面不等于掌握；本课只记录已学习、练习通过、待复核复述、实操证据与待审核成果。W4D1 完成后下一步只说明 W4D1 的指标定义入口，不创建或修改 W4D1 内容。</p><button type="button" :disabled="readonly || !canCompleteCourse" @click="completeCourse">记录本课首学完成</button><button v-if="lesson.nextLesson" type="button" class="secondary" @click="emit('next-lesson-request', { from: lesson.id, to: lesson.nextLesson!.id })">查看下一课说明</button></div>
              </template>

              <div class="chapter-checkpoint"><div class="checkpoint-heading"><div><span>本章小闭环</span><h3>学习、练习、复述分别保存</h3></div><button type="button" class="reset-link" :disabled="readonly" @click="resetChapterCheckpoint(chapter)">清空练习与复述</button></div><button type="button" :class="['learn-toggle', { done: evidence.frameworkChapters[chapter.id].learn }]" :disabled="readonly" :aria-pressed="evidence.frameworkChapters[chapter.id].learn" @click="toggleChapterLearn(chapter)">{{ evidence.frameworkChapters[chapter.id].learn ? '已学习 · 再按撤销' : '标记本章已学习' }}</button><fieldset><legend>{{ chapter.practice.prompt }}</legend><label v-for="(option, index) in chapter.practice.options" :key="option"><input v-model="evidence.frameworkChapters[chapter.id].selectedIndex" type="radio" :name="`${chapter.id}-practice`" :value="index" :disabled="readonly" @change="publish"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</label></fieldset><div class="checkpoint-actions"><button type="button" :disabled="readonly || evidence.frameworkChapters[chapter.id].selectedIndex === null" @click="submitChapterPractice(chapter)">检查本章练习</button><p v-if="evidence.frameworkChapters[chapter.id].selectedIndex !== null" :class="{ passed: evidence.frameworkChapters[chapter.id].practicePassed }">{{ evidence.frameworkChapters[chapter.id].practicePassed ? chapter.practice.explanation : '未通过：回到本章系统阶段、责任与证据边界后重试。' }}</p></div><label class="retell-field"><span>{{ chapter.retellPrompt }}</span><small>量规：{{ chapter.retellRubric.join('；') }}</small><textarea v-model="evidence.frameworkChapters[chapter.id].retell" rows="4" :readonly="readonly" :aria-label="`第 ${chapter.number} 章复述`" @input="onChapterRetellInput(chapter)" /></label><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts > 0 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-feedback">{{ evidence.frameworkChapters[chapter.id].retellAttempts >= 2 ? '第二次仍未通过，对照参考答案重写后再提交。' : '未通过：按量规补齐后再提交；本次先不显示参考答案。' }}</p><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts >= 2 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-answer"><b>参考答案</b>{{ buildRetellReferenceAnswer(chapter) }}</p><div class="checkpoint-footer"><button type="button" :disabled="readonly" @click="submitChapterRetell(chapter)">保存复述为待复核</button><strong>{{ chapterStatusLabel(chapter) }}</strong></div></div>
            </section>
          </div>
        </main>

        <aside class="w1-route" aria-label="W4D1 七章学习路线"><div class="w1-route-head"><strong>七章学习路线</strong><span>{{ progressPercent }}%</span></div><div v-for="session in [1, 2]" :key="session" class="w1-route-group"><strong><span>时段 {{ session }}</span><span>{{ plan.chapters.filter((chapter) => chapter.session === session).length }} 章</span></strong><div class="w1-route-list"><button v-for="chapter in plan.chapters.filter((item) => item.session === session)" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></div></div><div class="w1-route-note"><strong>掌握未判定 · {{ progressPercent }}%</strong><br>当前位置与完成状态分开；清空重做立即撤销对应高亮。</div></aside>
      </div>
    </div>
  </article>
</template>

<style scoped src="./W11D1Day01CourseView.css"></style>
