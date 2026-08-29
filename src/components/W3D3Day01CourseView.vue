<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyExerciseEvidence, DailyLessonEvidenceState, LessonConsoleEntry, PrerequisiteDecision } from './DailyLessonView.vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import { getDay01FrameworkPlan, type Day01ChapterId, type Day01FrameworkChapter } from '../course/day01Framework'
import { countSubstantiveContribution } from '../course/evidenceQuality'
import { assessChapterRetell, buildRetellReferenceAnswer } from '../course/retellAssessment'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<infer U> ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }
type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'
type BasicQueryScenario = 'q1-paid-orders' | 'q2-app-channel-orders' | 'q3-orders-on-20260831' | 'q4-recent-paid-orders' | 'q5-paid-time-alias' | 'q6-distinct-channels'

interface ChapterEvidence {
  learn: boolean
  selectedIndex: number | null
  practicePassed: boolean
  retell: string
  retellSubmitted: boolean
  retellAttempts: number
}

type W3D3Evidence = DailyLessonEvidenceState & {
  contentVersion: string
  frameworkChapters: Record<Day01ChapterId, ChapterEvidence>
}

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<W3D3Evidence>
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
  const resolved = getDay01FrameworkPlan(props.lesson.id)
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

function blankEvidence(): W3D3Evidence {
  return {
    schemaVersion: 2,
    lessonId: props.lesson.id,
    contentVersion: props.lesson.contentVersion,
    prerequisiteDecisions: Object.fromEntries(props.lesson.prerequisites.map((item) => [item.id, '' as PrerequisiteDecision])),
    visitedConceptIds: [], expandedConceptIds: [], completedSections: [],
    sandbox: { activePanel: 'elements', previewHeadline: '6 道基础查询练习台', domDraft: '', domEdits: 0, ageInput: 'q1-paid-orders', buttonState: 'idle', buttonClicks: 0, consoleHistory: [] },
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

function mergeEvidence(source?: DeepPartial<W3D3Evidence>): W3D3Evidence {
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

const evidence = ref<W3D3Evidence>(mergeEvidence(props.evidenceState))
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

function cloneEvidence(): W3D3Evidence { return JSON.parse(JSON.stringify(evidence.value)) as W3D3Evidence }
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

const ordersSampleRows = [
  { order_id: 'O1001', user_id: 'U001', status: 'paid', channel: 'app', paid_amount: '89.00', paid_at: '2026-08-31 00:15:12', is_test: '0' },
  { order_id: 'O1002', user_id: 'U002', status: 'paid', channel: 'web', paid_amount: '129.00', paid_at: '2026-08-31 01:03:45', is_test: '0' },
  { order_id: 'O1003', user_id: 'U003', status: 'cancelled', channel: 'app', paid_amount: '59.00', paid_at: 'NULL', is_test: '0' },
  { order_id: 'O1004', user_id: 'U001', status: 'paid', channel: 'app', paid_amount: '39.00', paid_at: '2026-08-31 08:20:01', is_test: '0' },
  { order_id: 'O1005', user_id: 'U004', status: 'refunded', channel: 'miniapp', paid_amount: '199.00', paid_at: '2026-08-31 09:10:00', is_test: '0' },
  { order_id: 'O1006', user_id: 'U005', status: 'paid', channel: 'miniapp', paid_amount: '79.50', paid_at: '2026-08-31 10:05:33', is_test: '0' },
  { order_id: 'O1007', user_id: 'U006', status: 'paid', channel: 'app', paid_amount: '259.00', paid_at: '2026-08-31 11:42:08', is_test: '0' },
  { order_id: 'O1008', user_id: 'U007', status: 'paid', channel: 'web', paid_amount: '0.00', paid_at: '2026-08-31 12:11:09', is_test: '0' },
] as const

const firstCompleteQuery = {
  businessQuestion: '查看 2026-08-31 当天已支付订单，输出订单号、用户、状态和支付时间，并按支付时间倒序看最近样本。',
  sql: 'SELECT order_id, user_id, status, paid_at AS paid_time FROM orders WHERE status = "paid" AND paid_at >= "2026-08-31" AND paid_at < "2026-09-01" ORDER BY paid_at DESC LIMIT 3;',
  expected: '只留下 status 为 paid 且 paid_at 落在 2026-08-31 00:00:00 到 2026-09-01 00:00:00 之前的行，再按 paid_at 从晚到早展示 3 行。',
  actual: 'O1018、O1018、O1013；列头显示 paid_time。O1018 重复出现先只作为观察现象记录，重复来源留到 W3D4。',
  conceptSplit: 'FROM orders 先确定对象；WHERE status = "paid" 负责留下已支付行；paid_at >= 起点 AND paid_at < 下一天起点负责当天边界；SELECT 决定输出列；AS paid_time 只改这次结果列头；ORDER BY paid_at DESC 让较晚支付的行排在前面；LIMIT 3 只截取展示样本。',
  proves: '能证明这条本地单表查询的文本筛选、日期边界、列别名、排序和 LIMIT 样本窗口可复核。',
  cannotProve: '不能证明真实生产收入、订单总数、数据质量、重复来源、测试数据处理、聚合、GROUP BY、JOIN 或指标正确。',
} as const

const basicQueryTasks = [
  {
    id: 'q1-paid-orders',
    label: 'Q1 查已支付订单',
    target: 'basic-query-log.md + basic-sql-queries.sql',
    mode: '教学模拟',
    businessQuestion: '查看本地 orders 表中已支付订单的 order_id、user_id、status、paid_at。',
    sql: 'SELECT order_id, user_id, status, paid_at FROM orders WHERE status = "paid" LIMIT 5;',
    expected: 'status 等于 paid 的行留下；cancelled、pending、refunded 不应留下。',
    actual: 'O1001、O1002、O1004、O1006、O1007。',
    field: 'filter_condition',
    recordField: 'filter_condition 填 status = "paid"',
    observableChange: 'cancelled、pending、refunded 这些非 paid 行不会进入结果。',
    action: '把业务话“只看已支付订单”翻译成 WHERE status = "paid"，并记录非 paid 行被排除。',
    canProve: '能证明 WHERE 文本条件能筛出本地 paid 行样本。',
    cannotProve: '不能证明真实生产支付订单数、收入或 status 字段没有脏值。',
    deliverableHint: 'query_id、business_question、base_table、selected_columns、filter_condition、sql_text、observed_result、can_prove、cannot_prove。',
  },
  {
    id: 'q2-app-channel-orders',
    label: 'Q2 查 app 渠道订单',
    target: 'basic-query-log.md + basic-sql-queries.sql',
    mode: '教学模拟',
    businessQuestion: '查看本地 orders 表中 channel 为 app 的订单样本。',
    sql: 'SELECT order_id, channel, status FROM orders WHERE channel = "app" LIMIT 5;',
    expected: 'channel 等于 app 的行留下；web、miniapp 不应留下。',
    actual: 'O1001、O1003、O1004、O1007、O1009；状态可能不同。',
    field: 'filter_condition',
    recordField: 'filter_condition 填 channel = "app"',
    observableChange: '结果里 channel 都是 app，但 status 可能不同。',
    action: '把文本值 app 放进引号，确认 channel 条件和 paid 条件不是一回事。',
    canProve: '能证明 channel 文本值筛选可复核。',
    cannotProve: '不能证明 app 渠道订单数、渠道转化或测试订单是否应排除。',
    deliverableHint: '补 filter_condition=channel = "app"，date_boundary 写“本题不涉及日期”，sort_rule 写“未指定排序”。',
  },
  {
    id: 'q3-orders-on-20260831',
    label: 'Q3 查 2026-08-31 当天支付订单',
    target: 'basic-query-log.md + basic-sql-queries.sql',
    mode: '教学模拟',
    businessQuestion: '查看 status 为 paid 且 paid_at 落在 2026-08-31 当天的订单样本。',
    sql: 'SELECT order_id, user_id, status, paid_at FROM orders WHERE status = "paid" AND paid_at >= "2026-08-31" AND paid_at < "2026-09-01" LIMIT 5;',
    expected: 'status 等于 paid，paid_at 从 2026-08-31 00:00:00 开始，到 2026-09-01 00:00:00 之前。',
    actual: 'O1001、O1002、O1004、O1006、O1007。',
    field: 'date_boundary',
    recordField: 'date_boundary 填 paid_at >= "2026-08-31" AND paid_at < "2026-09-01"',
    observableChange: '结果同时满足 paid 状态和 2026-08-31 当天边界。',
    action: '把“当天支付订单”翻译成 status 文本条件加 paid_at 闭开时间窗口。',
    canProve: '能证明 paid 状态和日期边界可以组合成可复核筛选。',
    cannotProve: '不能证明时区、延迟刷新、NULL paid_at、重复或测试数据是否应排除。',
    deliverableHint: '补 filter_condition=status = "paid"，date_boundary 写 >= 2026-08-31 且 < 2026-09-01。',
  },
  {
    id: 'q4-recent-paid-orders',
    label: 'Q4 按支付时间倒序看最近订单',
    target: 'basic-query-log.md + basic-sql-queries.sql',
    mode: '教学模拟',
    businessQuestion: '查看本地 orders 表中按 paid_at 倒序展示的最近已支付订单样本。',
    sql: 'SELECT order_id, user_id, paid_at FROM orders WHERE status = "paid" ORDER BY paid_at DESC LIMIT 5;',
    expected: 'status 为 paid 的行留下，并按 paid_at 从晚到早排列。',
    actual: 'O1019、O1014、O1018、O1018、O1013。',
    field: 'sort_rule',
    recordField: 'sort_rule 填 ORDER BY paid_at DESC',
    observableChange: '较晚的 paid_at 排在前面；LIMIT 5 只是截取前 5 行。',
    action: '用 ORDER BY paid_at DESC 解释“最近”，LIMIT 只截取展示窗口。',
    canProve: '能证明 ORDER BY paid_at DESC 决定展示顺序。',
    cannotProve: '不能证明全量趋势，也不能解释为什么 O1018 出现两次。',
    deliverableHint: '补 sort_rule=ORDER BY paid_at DESC；不能把 LIMIT 5 写成全量结论。',
  },
  {
    id: 'q5-paid-time-alias',
    label: 'Q5 给 paid_at 起业务别名 paid_time',
    target: 'basic-query-log.md + basic-sql-queries.sql',
    mode: '教学模拟',
    businessQuestion: '查看最近支付订单，并把 paid_at 在结果里展示成 paid_time。',
    sql: 'SELECT order_id, paid_at AS paid_time FROM orders WHERE status = "paid" ORDER BY paid_at DESC LIMIT 3;',
    expected: '结果列头出现 paid_time；原表字段仍是 paid_at。',
    actual: 'O1019 paid_time=2026-09-01 09:10:00；O1014 paid_time=2026-09-01 00:00:00；O1018 paid_time=2026-08-31 23:30:30。',
    field: 'alias_used',
    recordField: 'alias_used 填 paid_at AS paid_time',
    observableChange: '结果列头显示 paid_time，原表字段仍叫 paid_at。',
    action: '用 paid_at AS paid_time 让列头可读，并记录 AS 不修改原表字段。',
    canProve: '能证明 AS 能改变本次查询结果列头，帮助业务阅读。',
    cannotProve: '不能证明数据库字段已经改名，也不修改原表结构。',
    deliverableHint: '补 alias_used=paid_at AS paid_time；记录它只改变本次结果列头。',
  },
  {
    id: 'q6-distinct-channels',
    label: 'Q6 用 DISTINCT channel 观察渠道取值',
    target: 'basic-query-log.md + basic-sql-queries.sql',
    mode: '教学模拟',
    businessQuestion: '查看本地 orders 表中出现过哪些 channel 取值。',
    sql: 'SELECT DISTINCT channel FROM orders ORDER BY channel;',
    expected: '相同 channel 只展示一次。',
    actual: 'app、miniapp、web。',
    field: 'distinct_rule',
    recordField: 'distinct_rule 填 SELECT DISTINCT channel',
    observableChange: '相同 channel 只展示一次，结果是 app、miniapp、web。',
    action: '用 DISTINCT 观察不同 channel 展示值，不把它写成渠道指标。',
    canProve: '能证明 DISTINCT 能展示本地样本里不重复的 channel 取值。',
    cannotProve: '不能证明每个渠道订单数、渠道用户数、渠道转化或指标口径。',
    deliverableHint: '补 distinct_rule=SELECT DISTINCT channel；observed_result 写 app、miniapp、web。',
  },
] as const satisfies ReadonlyArray<{
  id: BasicQueryScenario
  label: string
  target: string
  mode: string
  businessQuestion: string
  sql: string
  expected: string
  actual: string
  field: string
  recordField: string
  observableChange: string
  action: string
  canProve: string
  cannotProve: string
  deliverableHint: string
}>

const basicQueryScenarioValues = basicQueryTasks.map((task) => task.id)
const currentBasicQueryScenario = computed<BasicQueryScenario>(() => {
  const value = evidence.value.sandbox.ageInput
  return basicQueryScenarioValues.includes(value as BasicQueryScenario) ? value as BasicQueryScenario : 'q1-paid-orders'
})
const currentBasicQueryRun = computed(() => {
  const scenario = currentBasicQueryScenario.value
  const task = basicQueryTasks.find((item) => item.id === scenario) ?? basicQueryTasks[0]
  return { ...task, evidenceLimit: '只能证明本地教学模拟中的 6 道单表基础查询可复核，不能证明真实生产数据、数据质量、聚合、GROUP BY、JOIN 或业务指标正确' }
})
const basicQueryCoverage = computed(() => {
  const commands = evidence.value.sandbox.consoleHistory.map((entry) => entry.command)
  return Object.fromEntries(basicQueryTasks.map((task) => [task.id, commands.some((item) => item.includes(task.id))])) as Record<BasicQueryScenario, boolean>
})
function runBasicQueryObserver() {
  const run = currentBasicQueryRun.value; evidence.value.sandbox.buttonClicks += 1
  const runId = `w3d3-sqlite-${String(evidence.value.sandbox.buttonClicks).padStart(3, '0')}`
  evidence.value.sandbox.consoleHistory.push({ command: `${runId}|${currentBasicQueryScenario.value}`, output: `${run.recordField}；${run.observableChange}`, tone: 'normal' })
  evidence.value.guidedLab.observations['latest-basicQuery-run'] = `${runId} · ${run.label} · ${run.recordField} · ${run.observableChange}`
  announcement.value = `已追加 ${runId}；这是本地教学模拟，只记录这一题的 SQL、实际行和证据边界，不证明真实生产数据、数据质量、聚合、GROUP BY、JOIN 或业务指标正确。`; publish()
}
function resetBasicQueryObserver() {
  const blank = blankEvidence(); evidence.value.sandbox = blank.sandbox; evidence.value.guidedLab = blank.guidedLab
  setSectionComplete('guided-lab', false); announcement.value = '基础查询观察器与当前草稿已清空；历史正式尝试未删除。'; publish()
}
function completeGuidedLab() {
  const stepsReady = guidedSteps.value.every(({ index }) => evidence.value.guidedLab.stepComplete[String(index)])
  const recordsReady = guidedRecords.value.every(({ index }) => (evidence.value.guidedLab.records[String(index)] || '').trim().length >= 8)
  const checksReady = props.lesson.guidedLab.passCriteria.every((_, index) => evidence.value.guidedLab.passChecks[String(index)])
  if (evidence.value.guidedLab.prediction.trim().length < 12 || !Object.values(basicQueryCoverage.value).every(Boolean) || !stepsReady || !recordsReady || !checksReady) { announcement.value = '先完成预测、六条 基础查询路径、全部步骤、记录与通过标准。'; return }
  setSectionComplete('guided-lab', true); saveAttempt('guided-lab'); announcement.value = '基础查询实操证据已追加保存；它只证明本地教学模拟中的 6 道查询可复核。'
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
const validationFields = ['query_id', 'business_question', 'base_table', 'selected_columns', 'filter_condition', 'date_boundary', 'sort_rule', 'alias_used', 'distinct_rule', 'sql_text', 'observed_result', 'can_prove', 'cannot_prove', 'self_check_result', 'next_sql_task'] as const
const deliverableGate = computed(() => {
  const text = evidence.value.deliverable.draft
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const errors: string[] = []
  const fieldPresence = Object.fromEntries(validationFields.map((field) => [field, lower.includes(field)])) as Record<(typeof validationFields)[number], boolean>
  for (const field of validationFields) if (!fieldPresence[field]) errors.push(`缺少字段：${field}。`)
  const requiredBoundaryPhrases = ['教学模拟', '不能证明', 'W3D4', 'FROM', 'WHERE', 'SELECT', 'ORDER BY', 'DISTINCT', 'answers.sql', 'self_check.sql']
  for (const phrase of requiredBoundaryPhrases) if (!text.includes(phrase)) errors.push(`必须写明边界或下一步：${phrase}。`)
  const forbiddenClaims = [
    ['真实生产', '已证明'], ['业务指标', '正确'], ['JOIN', '已完成'], ['GROUP BY', '已完成'], ['聚合', '已完成'],
    ['W3D4', '已完成'], ['answers.sql', '照抄'], ['答案', '提前打开'],
  ]
  for (const [subject, claim] of forbiddenClaims) {
    if (text.includes(subject) && text.includes(claim)) errors.push(`不得越界声明：${subject}${claim}。`)
  }
  const questionReady = /business_question[\s\S]{0,260}(订单|orders|查询|样本|SELECT)/i.test(text)
  const tableReady = /base_table[\s\S]{0,160}orders/i.test(text)
  const queryIdReady = /query_id[\s\S]{0,180}(Q[1-6]|基础查询|paid|orders|channel|date)/i.test(text)
  const selectReady = /selected_columns[\s\S]{0,320}(SELECT|order_id|user_id|status|paid_at|列)/i.test(text)
  const whereReady = /filter_condition[\s\S]{0,360}(WHERE|status|paid|channel|条件|行|未设置)/i.test(text)
  const dateReady = /date_boundary[\s\S]{0,360}(>=|<|2026|起点|结束|不涉及日期|下一天)/i.test(text)
  const sortReady = /sort_rule[\s\S]{0,260}(ORDER BY|paid_at|DESC|未指定|排序)/i.test(text)
  const aliasReady = /alias_used[\s\S]{0,300}(AS|paid_time|别名|不使用别名)/i.test(text)
  const distinctReady = /distinct_rule[\s\S]{0,360}(DISTINCT|去重|不重复|不使用 DISTINCT)/i.test(text)
  const sqlReady = /sql_text[\s\S]{0,720}SELECT[\s\S]{0,260}FROM[\s\S]{0,120}orders/i.test(text)
  const observedReady = /observed_result[\s\S]{0,300}(教学模拟|行|列|样本|结果)/i.test(text)
  const canReady = /can_prove[\s\S]{0,420}(能证明|基础查询|筛选|排序|别名|DISTINCT|日期边界)/i.test(text)
  const cannotReady = /cannot_prove[\s\S]{0,620}(不能证明|真实生产|数据质量|聚合|GROUP BY|JOIN|业务指标|收入|用户数)/i.test(text)
  const selfCheckReady = /self_check_result[\s\S]{0,360}(self_check\.sql|通过|对照|未提前打开 answers\.sql)/i.test(text)
  const nextReady = /next_sql_task[\s\S]{0,180}W3D4/i.test(text)
  if (!queryIdReady) errors.push('query_id 必须写出查询编号或题目身份。')
  if (!questionReady) errors.push('business_question 必须写出具体查询问题。')
  if (!tableReady) errors.push('base_table 必须写出 orders。')
  if (!selectReady) errors.push('selected_columns 必须写出 SELECT 输出列。')
  if (!whereReady) errors.push('filter_condition 必须说明 WHERE 行过滤或未设置。')
  if (!dateReady) errors.push('date_boundary 必须写出日期起止边界或说明本题不涉及日期。')
  if (!sortReady) errors.push('sort_rule 必须写出 ORDER BY 或未指定排序边界。')
  if (!aliasReady) errors.push('alias_used 必须写出 AS 别名或说明本题不使用别名。')
  if (!distinctReady) errors.push('distinct_rule 必须写出 DISTINCT 去重规则或说明本题不使用 DISTINCT。')
  if (!sqlReady) errors.push('sql_text 必须包含从 orders 出发的 SELECT。')
  if (!observedReady) errors.push('observed_result 必须说明本地教学模拟看到的行、列或样本。')
  if (!canReady) errors.push('can_prove 必须限定到基础查询动作。')
  if (!cannotReady) errors.push('cannot_prove 必须写出真实生产、数据质量、聚合、GROUP BY、JOIN 或指标边界。')
  if (!selfCheckReady) errors.push('self_check_result 必须写出 self_check.sql 或对照结果，并声明未提前打开 answers.sql。')
  if (!nextReady) errors.push('next_sql_task 只能指向 W3D4。')
  return { valid: errors.length === 0, errors, lineCount: lines.length, fieldPresence, presentFields: validationFields.filter((field) => fieldPresence[field]).length }
})
const deliverableFieldStatus = computed(() => validationFields.map((field) => ({ field, done: deliverableGate.value.fieldPresence[field] })))
function completeDeliverable() {
  const checksReady = checklistSet.value.every(({ index }) => evidence.value.deliverable.checklist[String(index)])
  if (deliverableContribution.value < activePath.value.deliverableMinimumContributionCharacters || !checksReady || !deliverableGate.value.valid) { announcement.value = `成果需要至少 ${activePath.value.deliverableMinimumContributionCharacters} 个有效实写字符、完成自检，并通过 基础查询记录字段门禁。`; return }
  setSectionComplete('deliverable', true); saveAttempt('deliverable'); announcement.value = '6 道基础查询已作为待审核成果追加保存；真实生产数据、聚合、GROUP BY、JOIN 和业务指标仍未判定。'
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
      <header class="w1-appbar"><button type="button" class="w1-brand" @click="emit('navigate', 'today')"><span class="w1-brand-mark">PL</span><strong>产品技术实验室</strong></button><span class="w1-appbar-meta">COURSE / W3D3</span></header>
      <div class="w1-shell">
        <main class="w1-main">
          <header class="course-cover">
            <div><p class="eyebrow">WEEK 3 · DAY 3 · 双时段课程</p><h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1><p class="subtitle">{{ lesson.subtitle }}</p></div>
            <div class="cover-summary" aria-label="课程时间与进度"><div class="cover-summary-head"><strong>{{ visibleCourseMinutes }} 分钟</strong><span>建议分两次完成</span></div><div class="cover-progress"><i :style="{ width: `${progressPercent}%` }"></i></div><div class="cover-summary-labels"><span>本次专注 {{ durationMode }} 分钟</span><span>两时段 · 七章</span></div><div class="cover-evidence"><span>已学习 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].learn).length }}/7</span><span>练习通过 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].practicePassed).length }}/7</span><span>待复核复述 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].retellSubmitted).length }}/7</span><span>掌握未判定</span></div></div>
          </header>
          <section class="session-strip" aria-label="两个学习时段"><div class="session-card"><strong>第一时段 · {{ sessionOneMinutes }} 分钟</strong><span>{{ sessionOneTitles }}</span></div><div class="session-card"><strong>第二时段 · {{ sessionTwoMinutes }} 分钟</strong><span>{{ sessionTwoTitles }}</span></div></section>
          <details ref="mobileRoute" class="w1-mobile-route"><summary>章节目录 · {{ plan.chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1 }} / 7 {{ plan.chapters.find((chapter) => chapter.id === activeChapterId)?.title }}</summary><nav class="w1-route-list" aria-label="W3D3 移动端七章目录"><button v-for="chapter in plan.chapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></nav></details>
          <div class="course-protocol"><span>用户与订单基础查询</span><p>今天真正学习的是单表基础查询。本课只用本地教学模拟建立 `basic-sql-queries.sql` 与 `basic-query-log.md`：先看 orders 表样本，再跑一条完整查询，最后完成 Q1–Q6 六道正向查询。每题按“业务问题 → SQL → 预期留下哪些行 → 实际看到什么 → 能证明什么 → 不能证明什么”记录；字段清单只作为写完一题后的自检，不连接真实数据库、不读取公司数据、不提前打开 answers.sql，也不把样本结果写成数据质量、聚合、GROUP BY、JOIN 或业务指标结论。前置不足只提示补学，不锁全文。</p></div>
          <p v-if="announcement" class="announcement" role="status" aria-live="polite">{{ announcement }}</p>

          <div class="manuscript">
            <section v-for="chapter in plan.chapters" :id="`${lesson.id.toLowerCase()}-${chapter.id}`" :key="chapter.id" class="framework-chapter" :data-framework-chapter="chapter.id" tabindex="-1">
              <header class="chapter-head"><div><span>SESSION {{ String(chapter.session).padStart(2, '0') }} · CHAPTER {{ String(chapter.number).padStart(2, '0') }}</span><h2>{{ chapter.title }}</h2><p>{{ chapter.lead }}</p></div><strong>{{ chapter.timeMinutes }} MIN</strong></header>

              <template v-if="chapter.number === 1">
                <div class="scenario-copy"><p><b>你的角色</b>{{ lesson.scenario.role }}</p><p><b>发生了什么</b>{{ lesson.scenario.situation }}</p><blockquote>{{ lesson.scenario.question }}</blockquote><p><b>为什么重要</b>{{ lesson.scenario.stakes }}</p></div>
                <div class="plain-section">
                  <h3>今天先看见对象：orders 表</h3>
                  <p>今天学的是单表基础查询，不是“SQL 术语速记”。学习入口是一张具体表：每一行是一条本地教学订单记录；产品经理常问的“只看已支付订单”“只看 app 渠道”“看 2026-08-31 当天支付订单”，都必须先落到这些字段上。</p>
                  <p>先看字段含义：order_id 是订单编号，user_id 是用户编号，status 是订单状态，channel 是来源渠道，paid_amount 是支付金额，paid_at 是支付时间，is_test 是测试标记。今天先练会查询动作，测试标记、重复行、空值和金额异常留到 W3D4。</p>
                  <div class="field-ledger">
                    <div><b>订单是谁</b><p>order_id 标识订单，user_id 标识用户；今天只读取它们，不判断用户画像。</p></div>
                    <div><b>订单处于什么状态</b><p>status 里有 paid、cancelled、refunded、pending；“只看已支付”要落成 status = "paid"。</p></div>
                    <div><b>订单从哪里来</b><p>channel 里有 app、miniapp、web；“只看 app”要落成 channel = "app"。</p></div>
                    <div><b>什么时候支付</b><p>paid_at 带具体时分秒；“某一天”要写起点和下一天起点，不能只写模糊日期。</p></div>
                  </div>
	                  <div class="system-console" aria-label="orders 表样本">
	                    <p class="simulation-label">来自 public/labs/W3-SQL基础/setup.sql 的本地教学样本</p>
	                    <table>
                      <thead><tr><th>order_id</th><th>user_id</th><th>status</th><th>channel</th><th>paid_amount</th><th>paid_at</th><th>is_test</th></tr></thead>
                      <tbody>
                        <tr v-for="row in ordersSampleRows" :key="row.order_id + row.user_id">
                          <td>{{ row.order_id }}</td><td>{{ row.user_id }}</td><td>{{ row.status }}</td><td>{{ row.channel }}</td><td>{{ row.paid_amount }}</td><td>{{ row.paid_at }}</td><td>{{ row.is_test }}</td>
                        </tr>
                      </tbody>
	                    </table>
	                  </div>
	                </div>
	                <div class="plain-section">
	                  <h3>先跑一条完整查询，再拆概念</h3>
	                  <p>先看一条能从头到尾解释的 SQL，再进入 WHERE、日期边界、ORDER BY、AS 和 DISTINCT。你要先知道这条查询在回答哪个业务问题、会留下哪些订单行、实际输出了什么，再拆术语。</p>
	                  <dl class="stage-ledger">
	                    <div><dt>业务问题</dt><dd>{{ firstCompleteQuery.businessQuestion }}</dd></div>
	                    <div><dt>SQL</dt><dd>{{ firstCompleteQuery.sql }}</dd></div>
	                    <div><dt>预期留下哪些行</dt><dd>{{ firstCompleteQuery.expected }}</dd></div>
	                    <div><dt>实际看到什么</dt><dd>{{ firstCompleteQuery.actual }}</dd></div>
	                    <div><dt>拆开看概念</dt><dd>{{ firstCompleteQuery.conceptSplit }}</dd></div>
	                    <div><dt>能证明什么</dt><dd>{{ firstCompleteQuery.proves }}</dd></div>
	                    <div><dt>不能证明什么</dt><dd>{{ firstCompleteQuery.cannotProve }}</dd></div>
	                  </dl>
	                </div>
	                <div class="plain-section"><h3>学完后要交出的证据</h3><ol class="objective-list"><li v-for="objective in lesson.objectives" :key="objective.id"><strong>{{ objective.text }}</strong><span>{{ objective.evidence }}</span></li></ol></div>
	                <div class="prerequisite-panel"><div><h3>跨阶段提前观看：提醒，不锁全文</h3><p>即使 W1/W2 或前一日未完成，也可从路线或深链直接阅读完整 W3D3。当前只检查本机终端和本地教学目录准备度；缺口只限制 `basic-query-log.md` 的实操结论，不隐藏课程。</p></div><fieldset v-for="item in lesson.prerequisites" :key="item.id"><legend>{{ item.prompt }}</legend><p>{{ item.passDescription }}</p><div class="decision-row"><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="pass" :disabled="readonly" @change="updatePrerequisite">已能独立做到</label><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="remediate" :disabled="readonly" @change="updatePrerequisite">需要先补学</label></div><div v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'" class="remediation"><b>{{ item.remediationLabel }}</b><ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol><a :href="item.remediationTarget">打开补学课程</a></div></fieldset></div>
              </template>

              <div v-if="chapter.number === 2 || chapter.number === 3" class="concept-ledger"><article v-for="concept in conceptsFor(chapter)" :id="`concept-${concept.id}`" :key="concept.id"><header><div><small>{{ concept.english }}</small><h3>{{ concept.term }}</h3></div><span>{{ concept.systemPosition }}</span></header><p class="concept-definition">{{ concept.definition }}</p><div class="concept-why"><p><b>为什么需要它</b>{{ concept.why }}</p><p><b>解决什么问题</b>{{ concept.problemSolved }}</p></div><dl><div><dt>输入</dt><dd>{{ concept.input }}</dd></div><div><dt>输出</dt><dd>{{ concept.output }}</dd></div><div><dt>责任人</dt><dd>{{ concept.owner }}</dd></div><div><dt>不负责</dt><dd>{{ concept.notResponsibleFor }}</dd></div><div><dt>与相邻层比较</dt><dd>{{ concept.compareWith }}</dd></div><div><dt>可观察证据</dt><dd>{{ concept.evidence.join('；') }}</dd></div></dl><ol class="concept-process"><li v-for="step in concept.process" :key="step">{{ step }}</li></ol><p class="pm-use"><b>产品经理怎样用：</b>{{ concept.pmUse }}</p><div class="example-pair"><div><b>正确例子</b>{{ concept.correctExample }}</div><div><b>越界例子</b>{{ concept.incorrectExample }}</div></div></article></div>

              <div v-if="chapter.number === 4" class="understanding-map"><span>query_id</span><i>→</i><span>business_question</span><i>→</i><span>WHERE/date</span><i>→</i><span>SELECT/AS</span><i>→</i><span>ORDER BY</span><i>→</i><span>DISTINCT</span><i>→</i><span>cannot_prove</span><p>先把问题落到 orders 数据源，再让 WHERE 选择行、日期边界限定窗口、SELECT 与 AS 形成可读列、ORDER BY 决定展示顺序、DISTINCT 只做去重观察，最后写出 self_check_result、can_prove 和 cannot_prove。任何本地教学模拟都不能代表真实生产数据、数据质量、聚合、GROUP BY、JOIN 或业务指标正确。</p></div>

              <template v-if="chapter.number === 5">
                <figure class="relationship-map"><figcaption><strong>{{ lesson.diagram.title }}</strong><span>{{ lesson.diagram.caption }}</span></figcaption><ol><li v-for="node in lesson.diagram.nodes" :key="node.id"><strong>{{ node.label }}</strong><p>{{ node.description }}</p><small>输入：{{ node.input }} · 输出：{{ node.output }}</small></li></ol><ul><li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind"><span>{{ branch.from }}</span><i>→</i><b>{{ branch.label }}</b><i>→</i><span>{{ branch.to }}</span></li></ul><div><b>读图时找这些证据</b><p v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</p></div></figure>
                <div class="demonstration"><h3>{{ lesson.demonstration.title }}</h3><p><b>业务问题：</b>{{ lesson.demonstration.businessProblem }}</p><ol><li v-for="(step, index) in lesson.demonstration.steps" :key="step.title"><span>{{ index + 1 }}</span><div><h4>{{ step.title }}</h4><p><b>教师操作：</b>{{ step.action }}</p><p><b>为什么：</b>{{ step.reason }}</p><p><b>看到：</b>{{ step.evidence }}</p><p><b>能证明：</b>{{ step.proves }}</p><p><b>不能证明：</b>{{ step.limitation }}</p></div></li></ol><div id="demonstration-conclusion" class="limited-conclusion"><p><b>有限结论：</b>{{ lesson.demonstration.finalConclusion }}</p><p><b>结论限制：</b>{{ lesson.demonstration.conclusionLimit }}</p></div></div>
                <div class="lab-panel">
                  <div class="lab-title"><div><span>教学模拟</span><h3>{{ lesson.guidedLab.title }}</h3><p>{{ lesson.guidedLab.goal }}</p></div><small>{{ lesson.guidedLab.safety }}</small></div>
                  <label class="field"><span>先预测</span><small>{{ lesson.guidedLab.predictionPrompt }}</small><textarea v-model="evidence.guidedLab.prediction" rows="3" :readonly="readonly" aria-label="基础查询 实验预测" @input="publish" /></label>
                  <div class="system-console">
                    <p class="simulation-label">教学模拟 · 只读取本地 SQLite 教学表 orders，不调用真实数据库、账号、Token、公司数据或生产系统</p>
                    <label><span>选择一道基础查询</span><select v-model="evidence.sandbox.ageInput" :disabled="readonly" aria-label="基础查询 教学场景" @change="publish"><option v-for="task in basicQueryTasks" :key="task.id" :value="task.id">{{ task.label }}</option></select></label>
                    <dl class="stage-ledger">
                      <div><dt>业务问题</dt><dd>{{ currentBasicQueryRun.businessQuestion }}</dd></div>
                      <div><dt>SQL</dt><dd>{{ currentBasicQueryRun.sql }}</dd></div>
                      <div><dt>预期留下哪些行</dt><dd>{{ currentBasicQueryRun.expected }}</dd></div>
                      <div><dt>实际看到什么</dt><dd>{{ currentBasicQueryRun.actual }}</dd></div>
                      <div><dt>能证明什么</dt><dd>{{ currentBasicQueryRun.canProve }}</dd></div>
                      <div><dt>不能证明什么</dt><dd>{{ currentBasicQueryRun.cannotProve }}</dd></div>
                      <div><dt>这一题先填什么</dt><dd>{{ currentBasicQueryRun.recordField }}</dd></div>
                      <div><dt>结果怎样变化</dt><dd>{{ currentBasicQueryRun.observableChange }}</dd></div>
                      <div><dt>证据边界</dt><dd>{{ currentBasicQueryRun.evidenceLimit }}</dd></div>
                    </dl>
                    <p class="first-fork"><b>{{ currentBasicQueryRun.label }}：</b>{{ currentBasicQueryRun.action }}</p>
                    <div class="console-actions"><button type="button" :disabled="readonly" @click="runBasicQueryObserver">运行并追加记录</button><button type="button" class="secondary" :disabled="readonly" @click="resetBasicQueryObserver">全部清空并重做</button></div>
                    <ol v-if="evidence.sandbox.consoleHistory.length" class="exchange-history" aria-label="基础查询 教学模拟追加历史"><li v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${entry.command}-${index}`"><code>{{ entry.command }}</code><span>{{ entry.output }}</span></li></ol>
                    <div class="simulation-coverage" aria-label="基础查询 实验覆盖"><span v-for="task in basicQueryTasks" :key="task.id" :class="{ done: basicQueryCoverage[task.id] }">{{ task.label }}</span></div>
                  </div>
                  <ol class="lab-steps">
                    <li v-for="task in basicQueryTasks" :key="task.id">
                      <label><input :checked="basicQueryCoverage[task.id]" type="checkbox" disabled><span><b>{{ task.label }}</b>{{ task.action }}</span></label>
                      <dl class="stage-ledger">
                        <div><dt>业务问题</dt><dd>{{ task.businessQuestion }}</dd></div>
                        <div><dt>SQL</dt><dd>{{ task.sql }}</dd></div>
                        <div><dt>预期留下</dt><dd>{{ task.expected }}</dd></div>
                        <div><dt>实际看到</dt><dd>{{ task.actual }}</dd></div>
                        <div><dt>能证明</dt><dd>{{ task.canProve }}</dd></div>
	                        <div><dt>不能证明</dt><dd>{{ task.cannotProve }}</dd></div>
	                        <div><dt>本题先填什么</dt><dd>{{ task.recordField }}</dd></div>
	                        <div><dt>结果怎样变化</dt><dd>{{ task.observableChange }}</dd></div>
	                        <div><dt>本题生成字段</dt><dd>{{ task.deliverableHint }}</dd></div>
	                      </dl>
	                    </li>
	                  </ol>
                  <ol class="lab-steps"><li v-for="item in guidedSteps" :key="item.index"><label><input v-model="evidence.guidedLab.stepComplete[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish"><span><b>{{ item.step.title }}</b>{{ item.step.action }}</span></label><p>观察：{{ item.step.observe }}</p><small>能证明：{{ item.step.proves }}；不能证明：{{ item.step.cannotProve }}</small></li></ol>
                  <div class="record-grid"><label v-for="item in guidedRecords" :key="item.index"><span>{{ item.prompt }}</span><textarea v-model="evidence.guidedLab.records[String(item.index)]" rows="3" :readonly="readonly" @input="publish" /></label></div>
                  <div class="check-list"><label v-for="(item, index) in lesson.guidedLab.passCriteria" :key="item"><input v-model="evidence.guidedLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div>
                  <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeGuidedLab">保存引导实验尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetBasicQueryObserver">全部清空并重做</button></div>
                </div>
              </template>

              <template v-if="chapter.number === 6">
                <div class="boundary-table"><h3>先修常见误判</h3><dl><div><dt>问题太模糊</dt><dd>“查订单”不能执行。先补 query_id 和 business_question，确认问题能落到 orders 字段。</dd></div><div><dt>日期只写等于</dt><dd>paid_at 带小时分钟，应用 paid_at >= 起点 AND paid_at < 下一天起点。</dd></div><div><dt>文本值没引号</dt><dd>channel = app 会被误读；文本值要写成 channel = "app"。</dd></div><div><dt>没排序说最新</dt><dd>没有 ORDER BY paid_at DESC，不能说第一行就是最新。</dd></div><div><dt>别名无意义</dt><dd>paid_at AS x 不利于交接；改成 paid_time，并记录 AS 不修改表结构。</dd></div><div><dt>DISTINCT 越界</dt><dd>SELECT DISTINCT channel 只展示 app、miniapp、web，不等于渠道订单数或指标口径。</dd></div></dl></div>
                <div class="independent-panel"><h3>{{ lesson.independentLab.title }}</h3><p>{{ lesson.independentLab.scenario }}</p><label><span>改变一个条件</span><select v-model="evidence.independentLab.changedCondition" :disabled="readonly" @change="publish"><option value="">请选择</option><option v-for="item in lesson.independentLab.changedConditions" :key="item" :value="item">{{ item }}</option></select></label><label><span>先预测</span><small>{{ lesson.independentLab.predictionPrompt }}</small><textarea v-model="evidence.independentLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label><label><span>检查计划</span><textarea v-model="evidence.independentLab.plan" rows="5" :readonly="readonly" aria-label="基础查询记录 检查计划" @input="publish" /></label><label><span>命令与证据</span><textarea v-model="evidence.independentLab.evidence" rows="5" :readonly="readonly" aria-label="基础查询记录 命令证据" @input="publish" /></label><label><span>观察结果</span><textarea v-model="evidence.independentLab.result" rows="3" :readonly="readonly" aria-label="基础查询记录 观察结果" @input="publish" /></label><label><span>四句有限结论</span><textarea v-model="evidence.independentLab.conclusion" rows="4" :readonly="readonly" aria-label="基础查询记录 有限结论" @input="publish" /></label><div class="check-list"><label v-for="(item, index) in lesson.independentLab.passCriteria" :key="item"><input v-model="evidence.independentLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeIndependentLab">保存独立变式尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetIndependentLab">清空并重做</button></div></div>
              </template>

              <template v-if="chapter.number === 7">
                <div class="practice-workshop"><h3>针对性练习</h3><p>先作答，再看逐项解释；WHERE、日期边界、ORDER BY、AS 和 DISTINCT 不能混写，更不能提前声称数据质量、聚合、GROUP BY、JOIN 或真实业务指标正确。</p><article v-for="(exercise, index) in exerciseSet" :key="exercise.id"><header><span>{{ index + 1 }}</span><div><h4>{{ exercise.prompt }}</h4><small>{{ exercise.categories.join(' · ') }}</small></div></header><div class="answer-options"><label v-for="(option, optionIndex) in exercise.options" :key="option.label"><input v-model="exerciseState(exercise).selectedIndex" type="radio" :name="exercise.id" :value="optionIndex" :disabled="readonly || exerciseState(exercise).submitted" @change="publish"><span>{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option.label }}</label></div><div v-if="exerciseState(exercise).submitted" :class="['exercise-feedback', exerciseState(exercise).selfAssessment]"><b>{{ exerciseState(exercise).selfAssessment === 'pass' ? '当前通过' : '对照后修正' }}</b><p>{{ exercise.referenceAnswer }}</p><ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol><p><b>逐项解释：</b>{{ exercise.options?.map((option) => `${option.label}：${option.rationale}；${option.couldBeTrueWhen}`).join('；') }}</p><p><b>常见错因：</b>{{ exercise.commonErrors.map((item) => `${item.error}：${item.reason}`).join('；') }}</p></div><div class="panel-actions"><button v-if="!exerciseState(exercise).submitted" type="button" :disabled="readonly" @click="submitExercise(exercise)">提交本题</button><button type="button" class="secondary" :disabled="readonly" @click="resetExercise(exercise)">清空并重做</button></div></article></div>
	                <div class="deliverable-panel"><h3>{{ lesson.deliverable.title }}</h3><p>{{ lesson.deliverable.purpose }}</p><p>不要先面对整张验收清单。先按 Q1–Q6 每做完一题生成一条记录：先写这题要回答什么，再粘贴 SQL，再写“预期留下哪些行”和“实际看到什么”，最后补 can_prove 与 cannot_prove；不涉及的字段在这一题里写“本题不使用”。</p><details open><summary>Q1-Q6 每题完成后该补哪些成果字段</summary><ol><li v-for="task in basicQueryTasks" :key="task.id"><b>{{ task.id }}：</b>{{ task.recordField }}；{{ task.deliverableHint }} SQL={{ task.sql }} 实际看到 {{ task.actual }}；{{ task.cannotProve }}</li></ol></details><div class="field-ledger"><div><b>第 1 步：题目身份</b><p>query_id、business_question、base_table。</p><small>例：Q1_paid_orders；查看本地 orders 表中已支付订单。</small></div><div><b>第 2 步：查询动作</b><p>selected_columns、filter_condition、date_boundary、sort_rule、alias_used、distinct_rule。</p><small>这一题用到什么就填什么；没用到的写“本题不使用”。</small></div><div><b>第 3 步：完整 SQL</b><p>sql_text 只放本题可执行 SELECT。</p><small>本日只允许 FROM orders，不写 GROUP BY 或 JOIN。</small></div><div><b>第 4 步：证据边界</b><p>observed_result、can_prove、cannot_prove、self_check_result、next_sql_task。</p><small>每题都要承认不能证明生产、质量、聚合或指标。</small></div></div><details><summary>完整字段含义自检，写完一题后再展开</summary><div class="field-ledger"><div v-for="field in lesson.deliverable.fields" :key="field.name"><b>{{ field.name }}</b><p>{{ field.meaning }}</p><small>证据来源：{{ field.source }}</small></div></div></details><details><summary>先看一份差稿怎样修正</summary><blockquote>{{ lesson.deliverable.badExample }}</blockquote><p><b>差稿问题：</b>{{ lesson.deliverable.badReasons.join('；') }}</p><ol><li v-for="item in lesson.deliverable.revisionSteps" :key="item">{{ item }}</li></ol><pre>{{ lesson.deliverable.goodExample }}</pre></details><div class="template-actions"><button type="button" :disabled="readonly" @click="useDeliverableTemplate('guided')">使用引导模板</button><button type="button" class="secondary" :disabled="readonly" @click="useDeliverableTemplate('blank')">使用空白模板</button></div><textarea v-model="evidence.deliverable.draft" rows="18" spellcheck="false" :readonly="readonly" :aria-label="`${lesson.deliverable.title} Markdown 草稿`" @input="evidence.deliverable.touched = true; setSectionComplete('deliverable', false); publish()" /><p class="counter">有效实写 {{ deliverableContribution }} / {{ activePath.deliverableMinimumContributionCharacters }} 字符 · 逐题记录字段 {{ deliverableGate.presentFields }}/15 项（写完后自检） · 非空行 {{ deliverableGate.lineCount }} · 边界门禁 {{ deliverableGate.valid ? '通过' : '待修复' }}</p><div class="simulation-coverage" aria-label="基础查询 逐题字段配额"><span v-for="item in deliverableFieldStatus" :key="item.field" :class="{ done: item.done }">{{ item.field }}</span><span :class="{ done: deliverableGate.valid }">{{ deliverableGate.valid ? '基础查询 valid' : '基础查询 待修复' }}</span></div><details v-if="deliverableGate.errors.length" class="remediation"><summary>查看 6 道基础查询门禁错误（{{ deliverableGate.errors.length }}）</summary><ol><li v-for="error in deliverableGate.errors" :key="error">{{ error }}</li></ol></details><div class="check-list"><label v-for="item in checklistSet" :key="item.index"><input v-model="evidence.deliverable.checklist[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item.item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeDeliverable">校验并保存完整 6 道基础查询</button><button type="button" class="secondary" :disabled="readonly" @click="resetDeliverable">清空并重做</button></div></div>
                <div class="memory-panel"><h3>最终复述与复习排程</h3><div class="check-list"><label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor"><input v-model="evidence.memory.anchorChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ anchor }}</label></div><label><span>闭卷解释</span><small>{{ lesson.memory.closedBookPrompt }}</small><textarea v-model="evidence.memory.closedBook" rows="6" :readonly="readonly" aria-label="W3D3 最终闭卷解释" @input="publish" /></label><label><span>微操作</span><small>{{ lesson.memory.microOperation }}</small><textarea v-model="evidence.memory.microOperation" rows="3" :readonly="readonly" aria-label="W3D3 记忆微操作" @input="publish" /></label><label><span>仍未解决的问题</span><small>{{ lesson.memory.unresolvedPrompt }}</small><textarea v-model="evidence.memory.unresolved" rows="3" :readonly="readonly" aria-label="W3D3 未解决问题" @input="publish" /></label><div class="review-timeline"><label v-for="(stage, index) in lesson.memory.reviewStages" :key="stage.stage"><input v-model="evidence.memory.reviewChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish"><b>{{ stage.stage }}</b><span>{{ stage.task }}</span></label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeMemory">保存最终复述与复习计划</button><button type="button" class="secondary" :disabled="readonly" @click="resetMemory">清空并重做</button></div></div>
                <div class="course-completion"><h3>完成核验</h3><p>完成页面不等于掌握；本课只记录已学习、练习通过、待复核复述、实操证据与待审核成果。W3D3 完成后下一步只进入 W3D4 说明，不创建或修改 W3D4 内容。</p><button type="button" :disabled="readonly || !canCompleteCourse" @click="completeCourse">记录本课首学完成</button><button v-if="lesson.nextLesson" type="button" class="secondary" @click="emit('next-lesson-request', { from: lesson.id, to: lesson.nextLesson!.id })">查看下一课说明</button></div>
              </template>

              <div class="chapter-checkpoint"><div class="checkpoint-heading"><div><span>本章小闭环</span><h3>学习、练习、复述分别保存</h3></div><button type="button" class="reset-link" :disabled="readonly" @click="resetChapterCheckpoint(chapter)">清空练习与复述</button></div><button type="button" :class="['learn-toggle', { done: evidence.frameworkChapters[chapter.id].learn }]" :disabled="readonly" :aria-pressed="evidence.frameworkChapters[chapter.id].learn" @click="toggleChapterLearn(chapter)">{{ evidence.frameworkChapters[chapter.id].learn ? '已学习 · 再按撤销' : '标记本章已学习' }}</button><fieldset><legend>{{ chapter.practice.prompt }}</legend><label v-for="(option, index) in chapter.practice.options" :key="option"><input v-model="evidence.frameworkChapters[chapter.id].selectedIndex" type="radio" :name="`${chapter.id}-practice`" :value="index" :disabled="readonly" @change="publish"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</label></fieldset><div class="checkpoint-actions"><button type="button" :disabled="readonly || evidence.frameworkChapters[chapter.id].selectedIndex === null" @click="submitChapterPractice(chapter)">检查本章练习</button><p v-if="evidence.frameworkChapters[chapter.id].selectedIndex !== null" :class="{ passed: evidence.frameworkChapters[chapter.id].practicePassed }">{{ evidence.frameworkChapters[chapter.id].practicePassed ? chapter.practice.explanation : '未通过：回到本章系统阶段、责任与证据边界后重试。' }}</p></div><label class="retell-field"><span>{{ chapter.retellPrompt }}</span><small>量规：{{ chapter.retellRubric.join('；') }}</small><textarea v-model="evidence.frameworkChapters[chapter.id].retell" rows="4" :readonly="readonly" :aria-label="`第 ${chapter.number} 章复述`" @input="onChapterRetellInput(chapter)" /></label><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts > 0 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-feedback">{{ evidence.frameworkChapters[chapter.id].retellAttempts >= 2 ? '第二次仍未通过，对照参考答案重写后再提交。' : '未通过：按量规补齐后再提交；本次先不显示参考答案。' }}</p><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts >= 2 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-answer"><b>参考答案</b>{{ buildRetellReferenceAnswer(chapter) }}</p><div class="checkpoint-footer"><button type="button" :disabled="readonly" @click="submitChapterRetell(chapter)">保存复述为待复核</button><strong>{{ chapterStatusLabel(chapter) }}</strong></div></div>
            </section>
          </div>
        </main>

        <aside class="w1-route" aria-label="W3D3 七章学习路线"><div class="w1-route-head"><strong>七章学习路线</strong><span>{{ progressPercent }}%</span></div><div v-for="session in [1, 2]" :key="session" class="w1-route-group"><strong><span>时段 {{ session }}</span><span>{{ plan.chapters.filter((chapter) => chapter.session === session).length }} 章</span></strong><div class="w1-route-list"><button v-for="chapter in plan.chapters.filter((item) => item.session === session)" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></div></div><div class="w1-route-note"><strong>掌握未判定 · {{ progressPercent }}%</strong><br>当前位置与完成状态分开；清空重做立即撤销对应高亮。</div></aside>
      </div>
    </div>
  </article>
</template>

<style scoped src="./W11D1Day01CourseView.css"></style>
