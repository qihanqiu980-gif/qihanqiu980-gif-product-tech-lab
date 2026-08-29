<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyExerciseEvidence, DailyLessonEvidenceState, LessonConsoleEntry, PrerequisiteDecision } from './DailyLessonView.vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import { getDay01FrameworkPlan, type Day01ChapterId, type Day01FrameworkChapter } from '../course/day01Framework'
import { countSubstantiveContribution } from '../course/evidenceQuality'
import { assessChapterRetell, buildRetellReferenceAnswer } from '../course/retellAssessment'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<infer U> ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }
type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'
type RequestCheckScenario = 'scope-missing' | 'field-source-missing' | 'filter-rule-missing' | 'time-window-ambiguous' | 'quality-exclusion-missing' | 'qualified-data-request'

interface ChapterEvidence {
  learn: boolean
  selectedIndex: number | null
  practicePassed: boolean
  retell: string
  retellSubmitted: boolean
  retellAttempts: number
}

type W3D5Evidence = DailyLessonEvidenceState & {
  contentVersion: string
  frameworkChapters: Record<Day01ChapterId, ChapterEvidence>
}

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<W3D5Evidence>
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

function blankEvidence(): W3D5Evidence {
  return {
    schemaVersion: 2,
    lessonId: props.lesson.id,
    contentVersion: props.lesson.contentVersion,
    prerequisiteDecisions: Object.fromEntries(props.lesson.prerequisites.map((item) => [item.id, '' as PrerequisiteDecision])),
    visitedConceptIds: [], expandedConceptIds: [], completedSections: [],
    sandbox: { activePanel: 'elements', previewHeadline: '6 条取数需求确认台', domDraft: '', domEdits: 0, ageInput: 'scope-missing', buttonState: 'idle', buttonClicks: 0, consoleHistory: [] },
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

function mergeEvidence(source?: DeepPartial<W3D5Evidence>): W3D5Evidence {
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

const evidence = ref<W3D5Evidence>(mergeEvidence(props.evidenceState))
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

function cloneEvidence(): W3D5Evidence { return JSON.parse(JSON.stringify(evidence.value)) as W3D5Evidence }
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
  { order_id: 'O1003', user_id: 'U003', status: 'cancelled', channel: 'app', paid_amount: '59.00', paid_at: 'NULL', is_test: '0' },
  { order_id: 'O1008', user_id: 'U007', status: 'paid', channel: 'web', paid_amount: '0.00', paid_at: '2026-08-31 12:11:09', is_test: '0' },
  { order_id: 'O1009', user_id: 'TEST1', status: 'paid', channel: 'app', paid_amount: '9999.00', paid_at: '2026-08-31 12:30:00', is_test: '1' },
  { order_id: 'O1014', user_id: 'U012', status: 'paid', channel: 'app', paid_amount: '209.00', paid_at: '2026-09-01 00:00:00', is_test: '0' },
  { order_id: 'O1016', user_id: 'NULL', status: 'paid', channel: 'web', paid_amount: '66.00', paid_at: '2026-08-31 20:20:20', is_test: '0' },
  { order_id: 'O1017', user_id: 'U014', status: 'paid', channel: 'app', paid_amount: 'NULL', paid_at: '2026-08-31 21:11:11', is_test: '0' },
  { order_id: 'O1018', user_id: 'U015', status: 'paid', channel: 'miniapp', paid_amount: '89.00', paid_at: '2026-08-31 23:30:30', is_test: '0' },
  { order_id: 'O1018', user_id: 'U015', status: 'paid', channel: 'miniapp', paid_amount: '89.00', paid_at: '2026-08-31 23:30:30', is_test: '0' },
] as const

const requestCheckTasks = [
  {
    id: 'scope-missing',
    label: 'R1 修正范围缺失',
    target: 'data-request.md',
    mode: '教学模拟',
    businessQuestion: '原请求只写“帮我取订单数据”，数据研发不知道服务哪次业务讨论。',
    sql: '目的修正：为 2026-08-31 app 渠道 paid 订单复盘取订单明细。',
    expected: '留下 business_question、decision_context 和 cannot_prove，不先进入指标计算。',
    actual: 'business_question 具体到 app 渠道 paid 明细；decision_context 是运营复盘前口径确认。',
    field: 'business_question',
    metric: 'request_id=R1-scope-missing; decision_context=运营复盘前口径确认',
    conclusion: 'scope_contract_ready',
    action: '把“取订单数据”改成“为哪次讨论取哪类订单明细”。',
    canProve: '能证明取数目的和范围被明确提出。',
    cannotProve: '不能证明数据已经取出、真实业务表现或指标正确。',
  },
  {
    id: 'field-source-missing',
    label: 'R2 补表和字段来源',
    target: 'data-request.md',
    mode: '教学模拟',
    businessQuestion: '原请求没有说明数据来自 orders，也没有说明需要哪些字段。',
    sql: 'base_table: orders; required_fields: order_id,user_id,status,channel,paid_amount,paid_at,is_test。',
    expected: '字段能覆盖身份、状态、渠道、金额、时间和测试排除。',
    actual: 'required_fields 中 paid_at 用于时间窗口，is_test 用于排除，order_id 用于识别 O1018。',
    field: 'required_fields',
    metric: 'base_table=orders; field_source_assumption=orders teaching table',
    conclusion: 'field_source_contract_ready',
    action: '把“订单字段”拆成表名、字段名和字段用途。',
    canProve: '能证明本地教学取数输入已写清。',
    cannotProve: '不能证明真实生产表名、字段血缘或权限已经确认。',
  },
  {
    id: 'filter-rule-missing',
    label: 'R3 补筛选规则',
    target: 'data-request.md',
    mode: '教学模拟',
    businessQuestion: '原请求写“有效订单”，但没有把口语翻译成字段和值。',
    sql: 'filter_rules: status = "paid" AND channel = "app"; status_scope: include paid, exclude cancelled/refunded/pending。',
    expected: '数据研发可以把规则转成 WHERE 条件。',
    actual: 'status="paid" 和 channel="app" 明确留下哪些行，其他状态先不纳入。',
    field: 'filter_rules',
    metric: 'filter_rule_contract=status paid + channel app',
    conclusion: 'filter_rule_contract_ready',
    action: '把“有效订单/app 订单”改成 status 和 channel 的可执行条件。',
    canProve: '能证明筛选口径已明确。',
    cannotProve: '不能证明所有状态枚举和最终指标口径已经批准。',
  },
  {
    id: 'time-window-ambiguous',
    label: 'R4 修正时间窗口歧义',
    target: 'data-request.md',
    mode: '教学模拟',
    businessQuestion: '原请求写“8 月 31 日当天”，但没有 paid_at 起止边界和时区确认。',
    sql: 'time_window: paid_at >= "2026-08-31 00:00:00" AND paid_at < "2026-09-01 00:00:00"; timezone 待确认。',
    expected: 'O1014=2026-09-01 00:00:00 不被误纳入 8 月 31 日。',
    actual: '时间字段、起点、终点和时区未知都进入需求单。',
    field: 'time_window',
    metric: 'time_window_contract=closed_open_paid_at_boundary',
    conclusion: 'time_window_contract_ready',
    action: '把“当天”改成 paid_at 的闭开时间窗口。',
    canProve: '能证明本地教学需求的日期边界可复核。',
    cannotProve: '不能证明真实时区、延迟入库或跨系统时间一致。',
  },
  {
    id: 'quality-exclusion-missing',
    label: 'R5 补质量排除和标注',
    target: 'data-request.md',
    mode: '教学模拟',
    businessQuestion: '原请求没有说明 TEST1、O1018、NULL user_id、NULL paid_amount、0 元订单如何处理。',
    sql: 'quality_exclusions: exclude TEST1/is_test=1; flag O1018 duplicate; flag NULL user_id, NULL paid_amount and paid_amount=0。',
    expected: 'W3D4 的质量风险进入取数需求，而不是留在脑子里。',
    actual: 'TEST1、O1018、O1016、O1017 和 O1008 都成为 review_questions。',
    field: 'quality_exclusions',
    metric: 'quality_exclusion_contract=TEST1/O1018/NULL/zero_amount',
    conclusion: 'quality_exclusion_contract_ready',
    action: '把质量风险改成排除、保留或标注的待确认规则。',
    canProve: '能证明 W3D4 风险已进入取数需求交接。',
    cannotProve: '不能证明数据质量已修复、重复根因或真实排除规则已经批准。',
  },
  {
    id: 'qualified-data-request',
    label: 'R6 合格取数需求单',
    target: 'data-request.md',
    mode: '教学模拟',
    businessQuestion: '把目的、字段、筛选、时间、质量、输出和复核边界合并。',
    sql: 'sample_sql_or_pseudocode: SELECT order_id,user_id,status,channel,paid_amount,paid_at AS paid_time,is_test FROM orders WHERE status = "paid" AND channel = "app" AND paid_at >= "2026-08-31 00:00:00" AND paid_at < "2026-09-01 00:00:00" ORDER BY paid_at DESC;',
    expected: 'data-request.md 的 15 个字段齐全，可以交给数据研发复核。',
    actual: 'review_questions 包含 TEST1、O1018、NULL、0 元和 paid_at 时区。',
    field: 'review_questions',
    metric: 'request_contract=qualified; next_sql_task=W3D6',
    conclusion: 'qualified_data_request_ready',
    action: '把所有口径假设收束成一份可复核的 data-request.md。',
    canProve: '能证明本地教学取数需求结构合格。',
    cannotProve: '不能证明真实生产取数完成、指标正确、GROUP BY、JOIN 或 W3D6 查询答案正确。',
  },
] as const satisfies ReadonlyArray<{
  id: RequestCheckScenario
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
}>

const requestCheckScenarioValues = requestCheckTasks.map((task) => task.id)
const currentRequestCheckScenario = computed<RequestCheckScenario>(() => {
  const value = evidence.value.sandbox.ageInput
  return requestCheckScenarioValues.includes(value as RequestCheckScenario) ? value as RequestCheckScenario : 'scope-missing'
})
const currentRequestCheckRun = computed(() => {
  const scenario = currentRequestCheckScenario.value
  const task = requestCheckTasks.find((item) => item.id === scenario) ?? requestCheckTasks[0]
  return { ...task, evidenceLimit: '只能证明本地教学模拟中的取数需求口径可复核，不能证明真实生产数据已取出、口径已批准、指标、GROUP BY、JOIN 或 W3D6 查询答案正确' }
})
const requestCheckCoverage = computed(() => {
  const commands = evidence.value.sandbox.consoleHistory.map((entry) => entry.command)
  return Object.fromEntries(requestCheckTasks.map((task) => [task.id, commands.some((item) => item.includes(task.id))])) as Record<RequestCheckScenario, boolean>
})
function runRequestCheckObserver() {
  const run = currentRequestCheckRun.value; evidence.value.sandbox.buttonClicks += 1
  const runId = `w3d5-request-${String(evidence.value.sandbox.buttonClicks).padStart(3, '0')}`
  evidence.value.sandbox.consoleHistory.push({ command: `${runId}|${currentRequestCheckScenario.value}`, output: `${run.field} → ${run.conclusion}`, tone: 'normal' })
  evidence.value.guidedLab.observations['latest-data-request-run'] = `${runId} · ${run.label} · field=${run.field} · conclusion=${run.conclusion}`
  announcement.value = `已追加 ${runId}；这是本地教学模拟，只形成取数需求口径判断，不证明真实生产数据、指标、GROUP BY、JOIN 或 W3D6 查询答案正确。`; publish()
}
function resetRequestCheckObserver() {
  const blank = blankEvidence(); evidence.value.sandbox = blank.sandbox; evidence.value.guidedLab = blank.guidedLab
  setSectionComplete('guided-lab', false); announcement.value = '取数需求观察器与当前草稿已清空；历史正式尝试未删除。'; publish()
}
function completeGuidedLab() {
  const stepsReady = guidedSteps.value.every(({ index }) => evidence.value.guidedLab.stepComplete[String(index)])
  const recordsReady = guidedRecords.value.every(({ index }) => (evidence.value.guidedLab.records[String(index)] || '').trim().length >= 8)
  const checksReady = props.lesson.guidedLab.passCriteria.every((_, index) => evidence.value.guidedLab.passChecks[String(index)])
  if (evidence.value.guidedLab.prediction.trim().length < 12 || !Object.values(requestCheckCoverage.value).every(Boolean) || !stepsReady || !recordsReady || !checksReady) { announcement.value = '先完成预测、六条 取数需求路径、全部步骤、记录与通过标准。'; return }
  setSectionComplete('guided-lab', true); saveAttempt('guided-lab'); announcement.value = '取数需求实操证据已追加保存；它只证明本地教学模拟中的 6 条确认路径可复核。'
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
const validationFields = ['request_id', 'business_question', 'decision_context', 'base_table', 'required_fields', 'filter_rules', 'time_window', 'status_scope', 'quality_exclusions', 'expected_output', 'sample_sql_or_pseudocode', 'review_questions', 'can_prove', 'cannot_prove', 'next_sql_task'] as const
const deliverableGate = computed(() => {
  const text = evidence.value.deliverable.draft
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const errors: string[] = []
  const fieldPresence = Object.fromEntries(validationFields.map((field) => [field, lower.includes(field)])) as Record<(typeof validationFields)[number], boolean>
  for (const field of validationFields) if (!fieldPresence[field]) errors.push(`缺少字段：${field}。`)
  const requiredBoundaryPhrases = ['orders', 'status = "paid"', 'channel = "app"', 'paid_at >=', 'paid_at <', 'TEST1', 'O1018', 'NULL', '不能证明', 'W3D6']
  for (const phrase of requiredBoundaryPhrases) if (!text.includes(phrase)) errors.push(`必须写明边界或下一步：${phrase}。`)
  const forbiddenClaims = [
    ['真实生产', '已证明'], ['业务指标', '正确'], ['JOIN', '已完成'], ['GROUP BY', '已完成'], ['聚合', '已完成'],
    ['W3D6', '已完成'], ['真实生产', '正确'], ['口径', '已批准'],
  ]
  for (const [subject, claim] of forbiddenClaims) {
    if (text.includes(subject) && text.includes(claim)) errors.push(`不得越界声明：${subject}${claim}。`)
  }
  const requestIdReady = /request_id[\s\S]{0,180}(R[1-6]|qualified|scope|field|filter|time|quality)/i.test(text)
  const questionReady = /business_question[\s\S]{0,320}(订单|orders|复盘|paid|app|明细)/i.test(text)
  const contextReady = /decision_context[\s\S]{0,320}(复盘|评审|确认|暂不计算|口径)/i.test(text)
  const baseTableReady = /base_table[\s\S]{0,120}orders/i.test(text)
  const fieldsReady = /required_fields[\s\S]{0,420}(order_id|user_id)[\s\S]{0,420}(status|channel)[\s\S]{0,420}(paid_amount|paid_at|is_test)/i.test(text)
  const filterReady = /filter_rules[\s\S]{0,300}(status\s*=\s*"paid"|status=paid)[\s\S]{0,300}(channel\s*=\s*"app"|channel=app)/i.test(text)
  const timeReady = /time_window[\s\S]{0,420}paid_at[\s\S]{0,180}>=[\s\S]{0,180}2026-08-31[\s\S]{0,240}<[\s\S]{0,180}2026-09-01/i.test(text)
  const statusReady = /status_scope[\s\S]{0,300}(paid|cancelled|refunded|pending|exclude|include)/i.test(text)
  const qualityReady = /quality_exclusions[\s\S]{0,680}(TEST1|is_test)[\s\S]{0,680}(O1018|duplicate)[\s\S]{0,680}(NULL|0)/i.test(text)
  const outputReady = /expected_output[\s\S]{0,420}(CSV|明细|order-level|ORDER BY|paid_time)/i.test(text)
  const sqlReady = /sample_sql_or_pseudocode[\s\S]{0,900}SELECT[\s\S]{0,420}FROM[\s\S]{0,160}orders[\s\S]{0,420}WHERE/i.test(text)
  const reviewReady = /review_questions[\s\S]{0,700}(TEST1|is_test)[\s\S]{0,700}(O1018|去重|duplicate)[\s\S]{0,700}(NULL|0|paid_at|时区)/i.test(text)
  const canReady = /can_prove[\s\S]{0,520}(能证明|本地教学|取数需求|目的|字段|筛选|时间|复核)/i.test(text)
  const cannotReady = /cannot_prove[\s\S]{0,760}(不能证明|真实生产|口径已批准|数据质量已修复|指标|GROUP BY|JOIN|W3D6)/i.test(text)
  const nextReady = /next_sql_task[\s\S]{0,220}(W3D6|业务查询|下一步)/i.test(text)
  if (!requestIdReady) errors.push('request_id 必须写出取数需求编号。')
  if (!questionReady) errors.push('business_question 必须写出具体订单复盘问题。')
  if (!contextReady) errors.push('decision_context 必须写出复盘、评审或口径确认场景。')
  if (!baseTableReady) errors.push('base_table 必须指定 orders。')
  if (!fieldsReady) errors.push('required_fields 必须写出 order_id、user_id、status、channel、paid_amount、paid_at、is_test 等关键字段。')
  if (!filterReady) errors.push('filter_rules 必须写出 status="paid" 和 channel="app"。')
  if (!timeReady) errors.push('time_window 必须写出 paid_at 的闭开边界。')
  if (!statusReady) errors.push('status_scope 必须说明 paid 以及其他状态是否排除。')
  if (!qualityReady) errors.push('quality_exclusions 必须覆盖 TEST1、O1018、NULL 和 0 元。')
  if (!outputReady) errors.push('expected_output 必须说明明细、列名、排序或 CSV。')
  if (!sqlReady) errors.push('sample_sql_or_pseudocode 必须包含从 orders 出发的 SELECT/WHERE 样例。')
  if (!reviewReady) errors.push('review_questions 必须写出 TEST1、O1018、NULL/0 元或 paid_at 时区等待确认问题。')
  if (!canReady) errors.push('can_prove 必须限定到本地教学取数需求结构。')
  if (!cannotReady) errors.push('cannot_prove 必须写出真实生产、根因、修复、聚合、GROUP BY、JOIN 或指标边界。')
  if (!nextReady) errors.push('next_sql_task 只能指向 W3D6 或后续业务查询，不能宣称 W3D6 查询答案已经正确。')
  return { valid: errors.length === 0, errors, lineCount: lines.length, fieldPresence, presentFields: validationFields.filter((field) => fieldPresence[field]).length }
})
const deliverableFieldStatus = computed(() => validationFields.map((field) => ({ field, done: deliverableGate.value.fieldPresence[field] })))
function completeDeliverable() {
  const checksReady = checklistSet.value.every(({ index }) => evidence.value.deliverable.checklist[String(index)])
  if (deliverableContribution.value < activePath.value.deliverableMinimumContributionCharacters || !checksReady || !deliverableGate.value.valid) { announcement.value = `成果需要至少 ${activePath.value.deliverableMinimumContributionCharacters} 个有效实写字符、完成自检，并通过 取数需求记录字段门禁。`; return }
  setSectionComplete('deliverable', true); saveAttempt('deliverable'); announcement.value = '取数需求单已作为待审核成果追加保存；真实生产数据、指标、GROUP BY、JOIN 和 W3D6 查询答案仍未判定。'
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
      <header class="w1-appbar"><button type="button" class="w1-brand" @click="emit('navigate', 'today')"><span class="w1-brand-mark">PL</span><strong>产品技术实验室</strong></button><span class="w1-appbar-meta">COURSE / W3D5</span></header>
      <div class="w1-shell">
        <main class="w1-main">
          <header class="course-cover">
            <div><p class="eyebrow">WEEK 3 · DAY 5 · 双时段课程</p><h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1><p class="subtitle">{{ lesson.subtitle }}</p></div>
            <div class="cover-summary" aria-label="课程时间与进度"><div class="cover-summary-head"><strong>{{ visibleCourseMinutes }} 分钟</strong><span>建议分两次完成</span></div><div class="cover-progress"><i :style="{ width: `${progressPercent}%` }"></i></div><div class="cover-summary-labels"><span>本次专注 {{ durationMode }} 分钟</span><span>两时段 · 七章</span></div><div class="cover-evidence"><span>已学习 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].learn).length }}/7</span><span>练习通过 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].practicePassed).length }}/7</span><span>待复核复述 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].retellSubmitted).length }}/7</span><span>掌握未判定</span></div></div>
          </header>
          <section class="session-strip" aria-label="两个学习时段"><div class="session-card"><strong>第一时段 · {{ sessionOneMinutes }} 分钟</strong><span>{{ sessionOneTitles }}</span></div><div class="session-card"><strong>第二时段 · {{ sessionTwoMinutes }} 分钟</strong><span>{{ sessionTwoTitles }}</span></div></section>
          <details ref="mobileRoute" class="w1-mobile-route"><summary>章节目录 · {{ plan.chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1 }} / 7 {{ plan.chapters.find((chapter) => chapter.id === activeChapterId)?.title }}</summary><nav class="w1-route-list" aria-label="W3D5 移动端七章目录"><button v-for="chapter in plan.chapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></nav></details>
          <div class="course-protocol"><span>用户与订单取数需求</span><p>本课只用本地教学模拟建立 `data-request.md`：写清 request_id、business_question、decision_context、base_table、required_fields、filter_rules、time_window、status_scope、quality_exclusions、expected_output、sample_sql_or_pseudocode、review_questions、can_prove、cannot_prove 和 next_sql_task。不连接真实数据库、不提交真实工单，也不把需求单写成生产数据、聚合、GROUP BY、JOIN、指标或 W3D6 业务查询结论。前置不足只提示补学，不锁全文。</p></div>
          <p v-if="announcement" class="announcement" role="status" aria-live="polite">{{ announcement }}</p>

          <div class="manuscript">
            <section v-for="chapter in plan.chapters" :id="`${lesson.id.toLowerCase()}-${chapter.id}`" :key="chapter.id" class="framework-chapter" :data-framework-chapter="chapter.id" tabindex="-1">
              <header class="chapter-head"><div><span>SESSION {{ String(chapter.session).padStart(2, '0') }} · CHAPTER {{ String(chapter.number).padStart(2, '0') }}</span><h2>{{ chapter.title }}</h2><p>{{ chapter.lead }}</p></div><strong>{{ chapter.timeMinutes }} MIN</strong></header>

              <template v-if="chapter.number === 1">
                <div class="scenario-copy"><p><b>你的角色</b>{{ lesson.scenario.role }}</p><p><b>发生了什么</b>{{ lesson.scenario.situation }}</p><blockquote>{{ lesson.scenario.question }}</blockquote><p><b>为什么重要</b>{{ lesson.scenario.stakes }}</p></div>
                <div class="plain-section">
                  <h3>今天先看见对象：orders 表和取数问题</h3>
                  <p>今天学的是取数需求单，不是再多写一条 SQL。先确认对象仍是本地 orders 表：每一行是一条教学订单记录，关键字段包括 order_id、user_id、status、channel、paid_amount、paid_at 和 is_test。随后把“我要 2026-08-31 app 渠道 paid 明细”写成数据研发可复核的目的、字段、筛选、时间、排除和输出。</p>
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
                <div class="plain-section"><h3>学完后要交出的证据</h3><ol class="objective-list"><li v-for="objective in lesson.objectives" :key="objective.id"><strong>{{ objective.text }}</strong><span>{{ objective.evidence }}</span></li></ol></div>
                <div class="prerequisite-panel"><div><h3>跨阶段提前观看：提醒，不锁全文</h3><p>即使 W1/W2 或前一日未完成，也可从路线或深链直接阅读完整 W3D5。当前只检查本机终端和本地教学目录准备度；缺口只限制 `data-request.md` 的实操结论，不隐藏课程。</p></div><fieldset v-for="item in lesson.prerequisites" :key="item.id"><legend>{{ item.prompt }}</legend><p>{{ item.passDescription }}</p><div class="decision-row"><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="pass" :disabled="readonly" @change="updatePrerequisite">已能独立做到</label><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="remediate" :disabled="readonly" @change="updatePrerequisite">需要先补学</label></div><div v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'" class="remediation"><b>{{ item.remediationLabel }}</b><ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol><a :href="item.remediationTarget">打开补学课程</a></div></fieldset></div>
              </template>

              <div v-if="chapter.number === 2 || chapter.number === 3" class="concept-ledger"><article v-for="concept in conceptsFor(chapter)" :id="`concept-${concept.id}`" :key="concept.id"><header><div><small>{{ concept.english }}</small><h3>{{ concept.term }}</h3></div><span>{{ concept.systemPosition }}</span></header><p class="concept-definition">{{ concept.definition }}</p><div class="concept-why"><p><b>为什么需要它</b>{{ concept.why }}</p><p><b>解决什么问题</b>{{ concept.problemSolved }}</p></div><dl><div><dt>输入</dt><dd>{{ concept.input }}</dd></div><div><dt>输出</dt><dd>{{ concept.output }}</dd></div><div><dt>责任人</dt><dd>{{ concept.owner }}</dd></div><div><dt>不负责</dt><dd>{{ concept.notResponsibleFor }}</dd></div><div><dt>与相邻层比较</dt><dd>{{ concept.compareWith }}</dd></div><div><dt>可观察证据</dt><dd>{{ concept.evidence.join('；') }}</dd></div></dl><ol class="concept-process"><li v-for="step in concept.process" :key="step">{{ step }}</li></ol><p class="pm-use"><b>产品经理怎样用：</b>{{ concept.pmUse }}</p><div class="example-pair"><div><b>正确例子</b>{{ concept.correctExample }}</div><div><b>越界例子</b>{{ concept.incorrectExample }}</div></div></article></div>

              <div v-if="chapter.number === 4" class="understanding-map"><span>business_question</span><i>→</i><span>base_table</span><i>→</i><span>filter_rules</span><i>→</i><span>time_window</span><i>→</i><span>quality_exclusions</span><i>→</i><span>review_questions</span><p>先说明取数服务哪次复盘，再指定 orders 和 required_fields；筛选要写成 status="paid"、channel="app"，时间要写 paid_at 闭开边界，最后把 TEST1、O1018、NULL、0 元和时区问题写成 review_questions。任何本地教学模拟都不能代表真实生产数据、口径批准、聚合、GROUP BY、JOIN、指标或 W3D6 查询答案正确。</p></div>

              <template v-if="chapter.number === 5">
                <figure class="relationship-map"><figcaption><strong>{{ lesson.diagram.title }}</strong><span>{{ lesson.diagram.caption }}</span></figcaption><ol><li v-for="node in lesson.diagram.nodes" :key="node.id"><strong>{{ node.label }}</strong><p>{{ node.description }}</p><small>输入：{{ node.input }} · 输出：{{ node.output }}</small></li></ol><ul><li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind"><span>{{ branch.from }}</span><i>→</i><b>{{ branch.label }}</b><i>→</i><span>{{ branch.to }}</span></li></ul><div><b>读图时找这些证据</b><p v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</p></div></figure>
                <div class="demonstration"><h3>{{ lesson.demonstration.title }}</h3><p><b>业务问题：</b>{{ lesson.demonstration.businessProblem }}</p><ol><li v-for="(step, index) in lesson.demonstration.steps" :key="step.title"><span>{{ index + 1 }}</span><div><h4>{{ step.title }}</h4><p><b>教师操作：</b>{{ step.action }}</p><p><b>为什么：</b>{{ step.reason }}</p><p><b>看到：</b>{{ step.evidence }}</p><p><b>能证明：</b>{{ step.proves }}</p><p><b>不能证明：</b>{{ step.limitation }}</p></div></li></ol><div id="demonstration-conclusion" class="limited-conclusion"><p><b>有限结论：</b>{{ lesson.demonstration.finalConclusion }}</p><p><b>结论限制：</b>{{ lesson.demonstration.conclusionLimit }}</p></div></div>
                <div class="lab-panel">
                  <div class="lab-title"><div><span>教学模拟</span><h3>{{ lesson.guidedLab.title }}</h3><p>{{ lesson.guidedLab.goal }}</p></div><small>{{ lesson.guidedLab.safety }}</small></div>
                  <label class="field"><span>先预测</span><small>{{ lesson.guidedLab.predictionPrompt }}</small><textarea v-model="evidence.guidedLab.prediction" rows="3" :readonly="readonly" aria-label="取数需求 实验预测" @input="publish" /></label>
                  <div class="system-console">
                    <p class="simulation-label">教学模拟 · 只读取本地 SQLite 教学表 orders，不调用真实数据库、账号、Token、公司数据或生产系统</p>
                    <label><span>选择一道取数需求</span><select v-model="evidence.sandbox.ageInput" :disabled="readonly" aria-label="取数需求 教学场景" @change="publish"><option v-for="task in requestCheckTasks" :key="task.id" :value="task.id">{{ task.label }}</option></select></label>
                    <dl class="stage-ledger">
                      <div><dt>业务问题</dt><dd>{{ currentRequestCheckRun.businessQuestion }}</dd></div>
                      <div><dt>修正写法</dt><dd>{{ currentRequestCheckRun.sql }}</dd></div>
                      <div><dt>预期补齐什么</dt><dd>{{ currentRequestCheckRun.expected }}</dd></div>
                      <div><dt>实际形成什么</dt><dd>{{ currentRequestCheckRun.actual }}</dd></div>
                      <div><dt>能证明什么</dt><dd>{{ currentRequestCheckRun.canProve }}</dd></div>
                      <div><dt>不能证明什么</dt><dd>{{ currentRequestCheckRun.cannotProve }}</dd></div>
                      <div><dt>写入字段</dt><dd>{{ currentRequestCheckRun.field }} · {{ currentRequestCheckRun.metric }}</dd></div>
                      <div><dt>Evidence limit</dt><dd>{{ currentRequestCheckRun.evidenceLimit }}</dd></div>
                    </dl>
                    <p class="first-fork"><b>{{ currentRequestCheckRun.label }}：</b>{{ currentRequestCheckRun.action }}</p>
                    <div class="console-actions"><button type="button" :disabled="readonly" @click="runRequestCheckObserver">运行并追加记录</button><button type="button" class="secondary" :disabled="readonly" @click="resetRequestCheckObserver">全部清空并重做</button></div>
                    <ol v-if="evidence.sandbox.consoleHistory.length" class="exchange-history" aria-label="取数需求 教学模拟追加历史"><li v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${entry.command}-${index}`"><code>{{ entry.command }}</code><span>{{ entry.output }}</span></li></ol>
                    <div class="simulation-coverage" aria-label="取数需求 实验覆盖"><span v-for="task in requestCheckTasks" :key="task.id" :class="{ done: requestCheckCoverage[task.id] }">{{ task.label }}</span></div>
                  </div>
                  <ol class="lab-steps">
                    <li v-for="task in requestCheckTasks" :key="task.id">
                      <label><input :checked="requestCheckCoverage[task.id]" type="checkbox" disabled><span><b>{{ task.label }}</b>{{ task.action }}</span></label>
                      <dl class="stage-ledger">
                        <div><dt>业务问题</dt><dd>{{ task.businessQuestion }}</dd></div>
                        <div><dt>修正写法</dt><dd>{{ task.sql }}</dd></div>
                        <div><dt>预期补齐</dt><dd>{{ task.expected }}</dd></div>
                        <div><dt>实际形成</dt><dd>{{ task.actual }}</dd></div>
                        <div><dt>能证明</dt><dd>{{ task.canProve }}</dd></div>
                        <div><dt>不能证明</dt><dd>{{ task.cannotProve }}</dd></div>
                      </dl>
                    </li>
                  </ol>
                  <ol class="lab-steps"><li v-for="item in guidedSteps" :key="item.index"><label><input v-model="evidence.guidedLab.stepComplete[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish"><span><b>{{ item.step.title }}</b>{{ item.step.action }}</span></label><p>观察：{{ item.step.observe }}</p><small>能证明：{{ item.step.proves }}；不能证明：{{ item.step.cannotProve }}</small></li></ol>
                  <div class="record-grid"><label v-for="item in guidedRecords" :key="item.index"><span>{{ item.prompt }}</span><textarea v-model="evidence.guidedLab.records[String(item.index)]" rows="3" :readonly="readonly" @input="publish" /></label></div>
                  <div class="check-list"><label v-for="(item, index) in lesson.guidedLab.passCriteria" :key="item"><input v-model="evidence.guidedLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div>
                  <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeGuidedLab">保存引导实验尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetRequestCheckObserver">全部清空并重做</button></div>
                </div>
              </template>

              <template v-if="chapter.number === 6">
                <div class="boundary-table"><h3>常见错法集中修正</h3><dl><div><dt>只说帮我取数</dt><dd>必须补 business_question、decision_context 和不能证明什么，否则数据研发无法判断取数目的。</dd></div><div><dt>只给字段名</dt><dd>字段必须绑定 base_table 和用途，paid_at、is_test、order_id 都有复核责任。</dd></div><div><dt>把有效订单写成口语</dt><dd>要写成 status="paid"、channel="app" 等可执行条件，并说明其他状态是否排除。</dd></div><div><dt>当天时间不写边界</dt><dd>2026-08-31 当天应使用 paid_at >= "2026-08-31 00:00:00" AND paid_at < "2026-09-01 00:00:00"。</dd></div><div><dt>忽略质量风险</dt><dd>TEST1、O1018、NULL 和 0 元都要进入 quality_exclusions 或 review_questions。</dd></div><div><dt>把需求单当结论</dt><dd>W3D5 只证明口径假设被清楚提出，不做聚合、GROUP BY、JOIN、收入、指标或 W3D6 查询答案判断。</dd></div></dl></div>
                <div class="independent-panel"><h3>{{ lesson.independentLab.title }}</h3><p>{{ lesson.independentLab.scenario }}</p><label><span>改变一个条件</span><select v-model="evidence.independentLab.changedCondition" :disabled="readonly" @change="publish"><option value="">请选择</option><option v-for="item in lesson.independentLab.changedConditions" :key="item" :value="item">{{ item }}</option></select></label><label><span>先预测</span><small>{{ lesson.independentLab.predictionPrompt }}</small><textarea v-model="evidence.independentLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label><label><span>检查计划</span><textarea v-model="evidence.independentLab.plan" rows="5" :readonly="readonly" aria-label="取数需求记录 检查计划" @input="publish" /></label><label><span>命令与证据</span><textarea v-model="evidence.independentLab.evidence" rows="5" :readonly="readonly" aria-label="取数需求记录 命令证据" @input="publish" /></label><label><span>观察结果</span><textarea v-model="evidence.independentLab.result" rows="3" :readonly="readonly" aria-label="取数需求记录 观察结果" @input="publish" /></label><label><span>四句有限结论</span><textarea v-model="evidence.independentLab.conclusion" rows="4" :readonly="readonly" aria-label="取数需求记录 有限结论" @input="publish" /></label><div class="check-list"><label v-for="(item, index) in lesson.independentLab.passCriteria" :key="item"><input v-model="evidence.independentLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeIndependentLab">保存独立变式尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetIndependentLab">清空并重做</button></div></div>
              </template>

              <template v-if="chapter.number === 7">
                <div class="practice-workshop"><h3>针对性练习</h3><p>先作答，再看逐项解释；取数需求要把目的、字段来源、筛选、时间、质量排除、输出和复核边界写清，不能提前声称生产数据、指标、GROUP BY、JOIN 或 W3D6 查询答案正确。</p><article v-for="(exercise, index) in exerciseSet" :key="exercise.id"><header><span>{{ index + 1 }}</span><div><h4>{{ exercise.prompt }}</h4><small>{{ exercise.categories.join(' · ') }}</small></div></header><div class="answer-options"><label v-for="(option, optionIndex) in exercise.options" :key="option.label"><input v-model="exerciseState(exercise).selectedIndex" type="radio" :name="exercise.id" :value="optionIndex" :disabled="readonly || exerciseState(exercise).submitted" @change="publish"><span>{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option.label }}</label></div><div v-if="exerciseState(exercise).submitted" :class="['exercise-feedback', exerciseState(exercise).selfAssessment]"><b>{{ exerciseState(exercise).selfAssessment === 'pass' ? '当前通过' : '对照后修正' }}</b><p>{{ exercise.referenceAnswer }}</p><ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol><p><b>逐项解释：</b>{{ exercise.options?.map((option) => `${option.label}：${option.rationale}；${option.couldBeTrueWhen}`).join('；') }}</p><p><b>常见错因：</b>{{ exercise.commonErrors.map((item) => `${item.error}：${item.reason}`).join('；') }}</p></div><div class="panel-actions"><button v-if="!exerciseState(exercise).submitted" type="button" :disabled="readonly" @click="submitExercise(exercise)">提交本题</button><button type="button" class="secondary" :disabled="readonly" @click="resetExercise(exercise)">清空并重做</button></div></article></div>
                <div class="deliverable-panel"><h3>{{ lesson.deliverable.title }}</h3><p>{{ lesson.deliverable.purpose }}</p><p>不要一开始硬填 15 个字段。先按 R1–R6 逐步生成：先写业务目的和表字段，再写筛选和时间窗口，然后把 TEST1、O1018、NULL、0 元写进 quality_exclusions，最后补 expected_output、review_questions、can_prove、cannot_prove 和 next_sql_task。</p><div class="field-ledger"><div><b>第 1 步：请求身份</b><p>request_id、business_question、decision_context。</p><small>例：R6-qualified-data-request；用于 2026-08-31 app paid 订单复盘。</small></div><div><b>第 2 步：数据对象</b><p>base_table、required_fields。</p><small>把 orders 和 order_id/user_id/status/channel/paid_amount/paid_at/is_test 写清。</small></div><div><b>第 3 步：口径规则</b><p>filter_rules、time_window、status_scope、quality_exclusions。</p><small>本日只写取数口径，不写 COUNT、GROUP BY 或 JOIN。</small></div><div><b>第 4 步：交付与边界</b><p>expected_output、sample_sql_or_pseudocode、review_questions、can_prove、cannot_prove、next_sql_task。</p><small>承认不能证明真实生产、口径批准、指标或 W3D6 答案。</small></div></div><details><summary>6 条确认路径分别生成哪些记录</summary><ol><li v-for="task in requestCheckTasks" :key="task.id"><b>{{ task.id }}：</b>{{ task.sql }} 实际形成 {{ task.actual }}；{{ task.cannotProve }}</li></ol></details><div class="field-ledger"><div v-for="field in lesson.deliverable.fields" :key="field.name"><b>{{ field.name }}</b><p>{{ field.meaning }}</p><small>证据来源：{{ field.source }}</small></div></div><details><summary>先看一份差稿怎样修正</summary><blockquote>{{ lesson.deliverable.badExample }}</blockquote><p><b>差稿问题：</b>{{ lesson.deliverable.badReasons.join('；') }}</p><ol><li v-for="item in lesson.deliverable.revisionSteps" :key="item">{{ item }}</li></ol><pre>{{ lesson.deliverable.goodExample }}</pre></details><div class="template-actions"><button type="button" :disabled="readonly" @click="useDeliverableTemplate('guided')">使用引导模板</button><button type="button" class="secondary" :disabled="readonly" @click="useDeliverableTemplate('blank')">使用空白模板</button></div><textarea v-model="evidence.deliverable.draft" rows="18" spellcheck="false" :readonly="readonly" :aria-label="`${lesson.deliverable.title} Markdown 草稿`" @input="evidence.deliverable.touched = true; setSectionComplete('deliverable', false); publish()" /><p class="counter">有效实写 {{ deliverableContribution }} / {{ activePath.deliverableMinimumContributionCharacters }} 字符 · 字段 {{ deliverableGate.presentFields }}/15 · 非空行 {{ deliverableGate.lineCount }} · 边界门禁 {{ deliverableGate.valid ? '通过' : '待修复' }}</p><div class="simulation-coverage" aria-label="取数需求 字段配额"><span v-for="item in deliverableFieldStatus" :key="item.field" :class="{ done: item.done }">{{ item.field }}</span><span :class="{ done: deliverableGate.valid }">{{ deliverableGate.valid ? '取数需求 valid' : '取数需求 待修复' }}</span></div><details v-if="deliverableGate.errors.length" class="remediation"><summary>查看取数需求单门禁错误（{{ deliverableGate.errors.length }}）</summary><ol><li v-for="error in deliverableGate.errors" :key="error">{{ error }}</li></ol></details><div class="check-list"><label v-for="item in checklistSet" :key="item.index"><input v-model="evidence.deliverable.checklist[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item.item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeDeliverable">校验并保存取数需求单</button><button type="button" class="secondary" :disabled="readonly" @click="resetDeliverable">清空并重做</button></div></div>
                <div class="memory-panel"><h3>最终复述与复习排程</h3><div class="check-list"><label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor"><input v-model="evidence.memory.anchorChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ anchor }}</label></div><label><span>闭卷解释</span><small>{{ lesson.memory.closedBookPrompt }}</small><textarea v-model="evidence.memory.closedBook" rows="6" :readonly="readonly" aria-label="W3D5 最终闭卷解释" @input="publish" /></label><label><span>微操作</span><small>{{ lesson.memory.microOperation }}</small><textarea v-model="evidence.memory.microOperation" rows="3" :readonly="readonly" aria-label="W3D5 记忆微操作" @input="publish" /></label><label><span>仍未解决的问题</span><small>{{ lesson.memory.unresolvedPrompt }}</small><textarea v-model="evidence.memory.unresolved" rows="3" :readonly="readonly" aria-label="W3D5 未解决问题" @input="publish" /></label><div class="review-timeline"><label v-for="(stage, index) in lesson.memory.reviewStages" :key="stage.stage"><input v-model="evidence.memory.reviewChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish"><b>{{ stage.stage }}</b><span>{{ stage.task }}</span></label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeMemory">保存最终复述与复习计划</button><button type="button" class="secondary" :disabled="readonly" @click="resetMemory">清空并重做</button></div></div>
                <div class="course-completion"><h3>完成核验</h3><p>完成页面不等于掌握；本课只记录已学习、练习通过、待复核复述、实操证据与待审核成果。W3D5 完成后下一步只进入 W3D6 业务查询集，不创建或修改 W3D6 内容。</p><button type="button" :disabled="readonly || !canCompleteCourse" @click="completeCourse">记录本课首学完成</button><button v-if="lesson.nextLesson" type="button" class="secondary" @click="emit('next-lesson-request', { from: lesson.id, to: lesson.nextLesson!.id })">查看下一课说明</button></div>
              </template>

              <div class="chapter-checkpoint"><div class="checkpoint-heading"><div><span>本章小闭环</span><h3>学习、练习、复述分别保存</h3></div><button type="button" class="reset-link" :disabled="readonly" @click="resetChapterCheckpoint(chapter)">清空练习与复述</button></div><button type="button" :class="['learn-toggle', { done: evidence.frameworkChapters[chapter.id].learn }]" :disabled="readonly" :aria-pressed="evidence.frameworkChapters[chapter.id].learn" @click="toggleChapterLearn(chapter)">{{ evidence.frameworkChapters[chapter.id].learn ? '已学习 · 再按撤销' : '标记本章已学习' }}</button><fieldset><legend>{{ chapter.practice.prompt }}</legend><label v-for="(option, index) in chapter.practice.options" :key="option"><input v-model="evidence.frameworkChapters[chapter.id].selectedIndex" type="radio" :name="`${chapter.id}-practice`" :value="index" :disabled="readonly" @change="publish"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</label></fieldset><div class="checkpoint-actions"><button type="button" :disabled="readonly || evidence.frameworkChapters[chapter.id].selectedIndex === null" @click="submitChapterPractice(chapter)">检查本章练习</button><p v-if="evidence.frameworkChapters[chapter.id].selectedIndex !== null" :class="{ passed: evidence.frameworkChapters[chapter.id].practicePassed }">{{ evidence.frameworkChapters[chapter.id].practicePassed ? chapter.practice.explanation : '未通过：回到本章系统阶段、责任与证据边界后重试。' }}</p></div><label class="retell-field"><span>{{ chapter.retellPrompt }}</span><small>量规：{{ chapter.retellRubric.join('；') }}</small><textarea v-model="evidence.frameworkChapters[chapter.id].retell" rows="4" :readonly="readonly" :aria-label="`第 ${chapter.number} 章复述`" @input="onChapterRetellInput(chapter)" /></label><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts > 0 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-feedback">{{ evidence.frameworkChapters[chapter.id].retellAttempts >= 2 ? '第二次仍未通过，对照参考答案重写后再提交。' : '未通过：按量规补齐后再提交；本次先不显示参考答案。' }}</p><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts >= 2 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-answer"><b>参考答案</b>{{ buildRetellReferenceAnswer(chapter) }}</p><div class="checkpoint-footer"><button type="button" :disabled="readonly" @click="submitChapterRetell(chapter)">保存复述为待复核</button><strong>{{ chapterStatusLabel(chapter) }}</strong></div></div>
            </section>
          </div>
        </main>

        <aside class="w1-route" aria-label="W3D5 七章学习路线"><div class="w1-route-head"><strong>七章学习路线</strong><span>{{ progressPercent }}%</span></div><div v-for="session in [1, 2]" :key="session" class="w1-route-group"><strong><span>时段 {{ session }}</span><span>{{ plan.chapters.filter((chapter) => chapter.session === session).length }} 章</span></strong><div class="w1-route-list"><button v-for="chapter in plan.chapters.filter((item) => item.session === session)" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></div></div><div class="w1-route-note"><strong>掌握未判定 · {{ progressPercent }}%</strong><br>当前位置与完成状态分开；清空重做立即撤销对应高亮。</div></aside>
      </div>
    </div>
  </article>
</template>

<style scoped src="./W11D1Day01CourseView.css"></style>
