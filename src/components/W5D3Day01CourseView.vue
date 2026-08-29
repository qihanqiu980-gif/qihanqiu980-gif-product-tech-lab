<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyExerciseEvidence, DailyLessonEvidenceState, LessonConsoleEntry, PrerequisiteDecision } from './DailyLessonView.vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import type { Day01ChapterId, Day01FrameworkChapter } from '../course/day01Framework'
import { getW5D3FrameworkPlan } from '../course/w5d3Framework'
import { countSubstantiveContribution } from '../course/evidenceQuality'
import { assessChapterRetell, buildRetellReferenceAnswer } from '../course/retellAssessment'

type DeepPartial<T> = { [K in keyof T]?: T[K] extends Array<infer U> ? U[] : T[K] extends object ? DeepPartial<T[K]> : T[K] }
type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'
type JoinScenario =
  | 'table-map'
  | 'join-users-events'
  | 'join-events-orders'
  | 'audit-row-count'
  | 'audit-unique-keys'
  | 'audit-amount-gap'

interface ChapterEvidence {
  learn: boolean
  selectedIndex: number | null
  practicePassed: boolean
  retell: string
  retellSubmitted: boolean
  retellAttempts: number
}

type W5D3Evidence = DailyLessonEvidenceState & {
  contentVersion: string
  frameworkChapters: Record<Day01ChapterId, ChapterEvidence>
}

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<W5D3Evidence>
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
  const resolved = getW5D3FrameworkPlan(props.lesson.id)
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

function blankEvidence(): W5D3Evidence {
  return {
    schemaVersion: 2,
    lessonId: props.lesson.id,
    contentVersion: props.lesson.contentVersion,
    prerequisiteDecisions: Object.fromEntries(props.lesson.prerequisites.map((item) => [item.id, '' as PrerequisiteDecision])),
    visitedConceptIds: [], expandedConceptIds: [], completedSections: [],
    sandbox: { activePanel: 'elements', previewHeadline: '多表 SQL 逐步记录台', domDraft: '', domEdits: 0, ageInput: 'map-source-tables', buttonState: 'idle', buttonClicks: 0, consoleHistory: [] },
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

function mergeEvidence(source?: DeepPartial<W5D3Evidence>): W5D3Evidence {
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

const evidence = ref<W5D3Evidence>(mergeEvidence(props.evidenceState))
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

function cloneEvidence(): W5D3Evidence { return JSON.parse(JSON.stringify(evidence.value)) as W5D3Evidence }
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

const joinSampleRows = [
  { join_case_id: 'J1-table-map', join_input_rows: 'users + events + orders', join_behavior: 'table map', join_result: 'roles_mapped=3', join_edge: '先分清三张表的责任' },
  { join_case_id: 'J2-users-events', join_input_rows: 'users + events', join_behavior: 'LEFT JOIN', join_result: 'rows_before=6 rows_after=10', join_edge: '先看行为是否放大' },
  { join_case_id: 'J3-events-orders', join_input_rows: 'events + orders', join_behavior: 'LEFT JOIN', join_result: 'amount_before=440 amount_after=740', join_edge: '再看金额是否被复制' },
] as const

const firstCompleteJoinRule = {
  join_case_id: 'J3-events-orders',
  join_ref: 'multi-table-sql-log.md / W5D3 多表 SQL 记录',
  join_input_rows: 'events 连接 orders 前的行为粒度与订单粒度输入。',
  join_rule: 'LEFT JOIN events e ON e.order_id = o.order_id，再比较 JOIN 前后行数。',
  join_behavior: '先看 rows_before / rows_after，再看 amount_before / amount_after 是否被复制。',
  join_key: 'order_id。',
  join_result: 'rows_before=10; rows_after=14; amount_before=440; amount_after=740。',
  join_edge: 'events 里有缺失 order_id；orders 里有缺失 event_id；金额被后续步骤复制。',
  cannot_prove: '不能证明真实生产分析、原因、趋势、报告或 W5D3 已完成。',
} as const

const joinTasks = [
  {
    id: 'table-map',
    label: '表角色地图',
    target: 'setup.sql + multi-table-sql-log.md',
    mode: '教学模拟',
    businessQuestion: '先把 users、events、orders 各自负责什么说清。',
    sql: 'setup.sql 里的表角色地图',
    expected: '先分清谁提供用户、行为和订单。',
    actual: 'roles_mapped=3。',
    field: 'step_id',
    metric: 'table map',
    conclusion: 'source_roles_known',
    action: '记录三张表的责任和连接顺序。',
    canProve: '能证明表角色先于连接顺序。',
    cannotProve: '不能证明真实生产表结构已经完全正确。',
    deliverableHint: '补 step_id、source_sql_ref、left_table、right_table、join_type、join_key。',
  },
  {
    id: 'join-users-events',
    label: '连接 users-events',
    target: 'exercises.sql + multi-table-sql-log.md',
    mode: '教学模拟',
    businessQuestion: 'users 连到 events 后规模如何变化。',
    sql: 'users LEFT JOIN events ON users.user_id = events.user_id',
    expected: '用户粒度先保留，再看行为是否复制。',
    actual: 'rows_before=6 rows_after=10。',
    field: 'rows_before',
    metric: 'row count',
    conclusion: 'user_to_event_step_ok',
    action: '记录第一步的行数和唯一键。',
    canProve: '能证明第一步已经改变行数。',
    cannotProve: '不能证明订单部分已经正确。',
    deliverableHint: '补 rows_before、rows_after、unique_keys、gap_note。',
  },
  {
    id: 'join-events-orders',
    label: '连接 events-orders',
    target: 'answers.sql + multi-table-sql-log.md',
    mode: '教学模拟',
    businessQuestion: 'events 再接 orders 后金额如何变化。',
    sql: 'events LEFT JOIN orders ON events.order_id = orders.order_id',
    expected: '订单金额可能被复制，需要单独审计。',
    actual: 'amount_before=440 amount_after=740。',
    field: 'amount_before',
    metric: 'amount audit',
    conclusion: 'event_to_order_amount_change',
    action: '记录第二步的金额前后变化。',
    canProve: '能证明金额在第二步发生变化。',
    cannotProve: '不能证明真实收入变化。',
    deliverableHint: '补 amount_before、amount_after、gap_note、cannot_prove。',
  },
  {
    id: 'audit-row-count',
    label: '行数审计',
    target: 'multi-table-sql-log.md + exercises.sql',
    mode: '教学模拟',
    businessQuestion: '哪一步最能看出规模变化。',
    sql: 'rows_before / rows_after',
    expected: '每一步都能看出增减。',
    actual: 'row count 变化被逐步记录。',
    field: 'rows_after',
    metric: 'row count audit',
    conclusion: 'stepwise_rows_visible',
    action: '记录每一步的 row count。',
    canProve: '能证明规模变化来自具体步骤。',
    cannotProve: '不能证明最终结果已经正确。',
    deliverableHint: '补 rows_before、rows_after、step_id、source_sql_ref。',
  },
  {
    id: 'audit-unique-keys',
    label: '唯一键审计',
    target: 'multi-table-sql-log.md + exercises.sql',
    mode: '教学模拟',
    businessQuestion: '哪一步最能看出唯一键有没有被复制。',
    sql: 'unique_keys',
    expected: '用户、行为和订单键都能单独核对。',
    actual: 'unique_keys 变化被逐步记录。',
    field: 'unique_keys',
    metric: 'unique key audit',
    conclusion: 'stepwise_keys_visible',
    action: '记录每一步的唯一键。',
    canProve: '能证明粒度变化和重复风险。',
    cannotProve: '不能证明金额一定正确。',
    deliverableHint: '补 unique_keys、rows_before、rows_after、gap_note。',
  },
  {
    id: 'audit-amount-gap',
    label: '金额审计',
    target: 'multi-table-sql-log.md + answers.sql',
    mode: '教学模拟',
    businessQuestion: '哪一步最能看出金额是否被复制。',
    sql: 'amount_before / amount_after',
    expected: '订单金额不会被默默放大。',
    actual: 'amount_before=440 amount_after=740。',
    field: 'amount_after',
    metric: 'amount audit',
    conclusion: 'stepwise_amount_visible',
    action: '记录每一步的金额前后变化。',
    canProve: '能证明金额变化来自哪一步。',
    cannotProve: '不能证明真实收入变化。',
    deliverableHint: '补 amount_before、amount_after、gap_note、cannot_prove。',
  },
] as const satisfies ReadonlyArray<{
  id: JoinScenario
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

const joinScenarioValues = joinTasks.map((task) => task.id)
const currentJoinScenario = computed<JoinScenario>(() => {
  const value = evidence.value.sandbox.ageInput
  return joinScenarioValues.includes(value as JoinScenario) ? value as JoinScenario : 'table-map'
})
const currentJoinRun = computed(() => {
  const scenario = currentJoinScenario.value
  const task = joinTasks.find((item) => item.id === scenario) ?? joinTasks[0]
  return { ...task, evidenceLimit: '只能证明本地 W5-多表SQL 教学库中的 多表 SQL可复核，不能证明真实生产 JOIN、多表 SQL、归因、趋势、看板发布或 W5D3 已完成' }
})
const joinCoverage = computed(() => {
  const commands = evidence.value.sandbox.consoleHistory.map((entry) => entry.command)
  return Object.fromEntries(joinTasks.map((task) => [task.id, commands.some((item) => item.includes(task.id))])) as Record<JoinScenario, boolean>
})
function runJoinObserver() {
  const run = currentJoinRun.value; evidence.value.sandbox.buttonClicks += 1
  const runId = `w5d3-join-${String(evidence.value.sandbox.buttonClicks).padStart(3, '0')}`
  evidence.value.sandbox.consoleHistory.push({ command: `${runId}|${currentJoinScenario.value}`, output: `${run.field} → ${run.conclusion}`, tone: 'normal' })
  evidence.value.guidedLab.observations['latest-metric-run'] = `${runId} · ${run.label} · field=${run.field} · conclusion=${run.conclusion}`
  announcement.value = `已追加 ${runId}；这是本地教学模拟，只形成 多表 SQL证据，不证明真实生产 JOIN、多表 SQL、归因、趋势、看板发布或 W5D3 已完成。`; publish()
}
function resetJoinObserver() {
  const blank = blankEvidence(); evidence.value.sandbox = blank.sandbox; evidence.value.guidedLab = blank.guidedLab
  setSectionComplete('guided-lab', false); announcement.value = '多表 SQL观察器与当前草稿已清空；历史正式尝试未删除。'; publish()
}
function completeGuidedLab() {
  const stepsReady = guidedSteps.value.every(({ index }) => evidence.value.guidedLab.stepComplete[String(index)])
  const recordsReady = guidedRecords.value.every(({ index }) => (evidence.value.guidedLab.records[String(index)] || '').trim().length >= 8)
  const checksReady = props.lesson.guidedLab.passCriteria.every((_, index) => evidence.value.guidedLab.passChecks[String(index)])
  if (evidence.value.guidedLab.prediction.trim().length < 12 || !Object.values(joinCoverage.value).every(Boolean) || !stepsReady || !recordsReady || !checksReady) { announcement.value = '先完成预测、6 条 JOIN 路径、引导步骤、记录与通过标准。'; return }
  setSectionComplete('guided-lab', true); saveAttempt('guided-lab'); announcement.value = '多表 SQL实操证据已追加保存；它只证明本地教学模拟中的 JOIN 保留规则可复核。'
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
const validationFields = ['join_case_id', 'left_table', 'right_table', 'join_type', 'preserve_rule', 'join_key', 'rows_before', 'rows_after', 'unique_keys', 'unmatched_keys', 'amount_gap', 'can_prove', 'cannot_prove', 'next_sql_task'] as const
const deliverableGate = computed(() => {
  const text = evidence.value.deliverable.draft
  const lower = text.toLowerCase()
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const errors: string[] = []
  const fieldPresence = Object.fromEntries(validationFields.map((field) => [field, lower.includes(field)])) as Record<(typeof validationFields)[number], boolean>
  for (const field of validationFields) if (!fieldPresence[field]) errors.push(`缺少字段：${field}。`)
  const requiredBoundaryPhrases = ['multi-table-sql-log.md', '多表 SQL 记录', 'W5D3', 'W5-多表SQL', '440', '740', 'O05', 'I08', 'LEFT JOIN', 'FULL JOIN', '先聚合再连接', '不能证明']
  for (const phrase of requiredBoundaryPhrases) if (!text.includes(phrase)) errors.push(`必须写明边界或下一步：${phrase}。`)
  const forbiddenClaims = [
    ['真实生产', '已证明'], ['业务 JOIN ', '正确'], [' JOIN ', '已经正确'], ['JOIN', '已完成'], ['看板', '可发布'], ['归因', '完成'],
    ['W5D3', '已完成'],
  ]
  for (const [subject, claim] of forbiddenClaims) {
    if (text.includes(subject) && text.includes(claim)) errors.push(`不得越界声明：${subject}${claim}。`)
  }
  const joinCaseReady = /join_case_id[\s\S]{0,220}(J\d|inner|left|right|full|amplification|gap)/i.test(text)
  const leftTableReady = /left_table[\s\S]{0,220}(orders|users|order_items)/i.test(text)
  const rightTableReady = /right_table[\s\S]{0,220}(orders|users|order_items)/i.test(text)
  const joinTypeReady = /join_type[\s\S]{0,220}(INNER|LEFT|RIGHT|FULL)/i.test(text)
  const preserveRuleReady = /preserve_rule[\s\S]{0,260}(保留|NULL|丢掉|左表|右表|两边)/i.test(text)
  const joinKeyReady = /join_key[\s\S]{0,220}(user_id|order_id)/i.test(text)
  const rowsBeforeReady = /rows_before[\s\S]{0,220}(\d+)/i.test(text)
  const rowsAfterReady = /rows_after[\s\S]{0,220}(\d+)/i.test(text)
  const uniqueKeysReady = /unique_keys[\s\S]{0,220}(\d+|order_id|item_id|user_id)/i.test(text)
  const unmatchedKeysReady = /unmatched_keys[\s\S]{0,320}(O05|I08|U99|MISSING|NULL)/i.test(text)
  const amountGapReady = /amount_gap[\s\S]{0,220}(\d+|440|740)/i.test(text)
  const joinCanReady = /can_prove[\s\S]{0,460}(能证明|本地|教学| JOIN |口径|可复核)/i.test(text)
  const joinCannotReady = /cannot_prove[\s\S]{0,760}(不能证明|真实生产|JOIN|归因|趋势|看板|W5D3| JOIN 正确)/i.test(text)
  const joinNextReady = /next_sql_task[\s\S]{0,420}(W5D3|先聚合再连接|回连订单|重算)/i.test(text)
  if (!joinCaseReady) errors.push('join_case_id 必须写出多表 SQL编号。')
  if (!leftTableReady) errors.push('left_table 必须写出左表。')
  if (!rightTableReady) errors.push('right_table 必须写出右表。')
  if (!joinTypeReady) errors.push('join_type 必须写出 INNER、LEFT、RIGHT 或 FULL。')
  if (!preserveRuleReady) errors.push('preserve_rule 必须写出保留规则。')
  if (!joinKeyReady) errors.push('join_key 必须写出连接键。')
  if (!rowsBeforeReady) errors.push('rows_before 必须写出 JOIN 前行数。')
  if (!rowsAfterReady) errors.push('rows_after 必须写出 JOIN 后行数。')
  if (!uniqueKeysReady) errors.push('unique_keys 必须写出唯一键数量或名称。')
  if (!unmatchedKeysReady) errors.push('unmatched_keys 必须写出未匹配键。')
  if (!amountGapReady) errors.push('amount_gap 必须写出金额差异。')
  if (!joinCanReady) errors.push('can_prove 必须限定到本地教学多表 SQL可复核。')
  if (!joinCannotReady) errors.push('cannot_prove 必须排除真实生产、JOIN、归因、趋势、看板或 W5D3 已完成。')
  if (!joinNextReady) errors.push('next_sql_task 必须指向 W5D3 的先聚合再连接。')
  return { valid: errors.length === 0, errors, lineCount: lines.length, fieldPresence, presentFields: validationFields.filter((field) => fieldPresence[field]).length }
})
const deliverableFieldStatus = computed(() => validationFields.map((field) => ({ field, done: deliverableGate.value.fieldPresence[field] })))
function completeDeliverable() {
  const checksReady = checklistSet.value.every(({ index }) => evidence.value.deliverable.checklist[String(index)])
  if (deliverableContribution.value < activePath.value.deliverableMinimumContributionCharacters || !checksReady || !deliverableGate.value.valid) { announcement.value = `成果需要至少 ${activePath.value.deliverableMinimumContributionCharacters} 个有效实写字符、完成自检，并通过 多表 SQL字段门禁。`; return }
  setSectionComplete('deliverable', true); saveAttempt('deliverable'); announcement.value = '多表 SQL 记录已作为待审核成果追加保存；真实生产 JOIN、多表 SQL、归因、趋势、看板发布和 W5D3 完成状态仍未判定。'
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
      <header class="w1-appbar"><button type="button" class="w1-brand" @click="emit('navigate', 'today')"><span class="w1-brand-mark">PL</span><strong>产品技术实验室</strong></button><span class="w1-appbar-meta">COURSE / W5D3</span></header>
      <div class="w1-shell">
        <main class="w1-main">
          <header class="course-cover">
            <div><p class="eyebrow">WEEK 5 · DAY 3 · 双时段课程</p><h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1><p class="subtitle">{{ lesson.subtitle }}</p></div>
            <div class="cover-summary" aria-label="课程时间与进度"><div class="cover-summary-head"><strong>{{ visibleCourseMinutes }} 分钟</strong><span>建议分两次完成</span></div><div class="cover-progress"><i :style="{ width: `${progressPercent}%` }"></i></div><div class="cover-summary-labels"><span>本次专注 {{ durationMode }} 分钟</span><span>两时段 · 七章</span></div><div class="cover-evidence"><span>已学习 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].learn).length }}/7</span><span>练习通过 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].practicePassed).length }}/7</span><span>待复核复述 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].retellSubmitted).length }}/7</span><span>掌握未判定</span></div></div>
          </header>
          <section class="session-strip" aria-label="两个学习时段"><div class="session-card"><strong>第一时段 · {{ sessionOneMinutes }} 分钟</strong><span>{{ sessionOneTitles }}</span></div><div class="session-card"><strong>第二时段 · {{ sessionTwoMinutes }} 分钟</strong><span>{{ sessionTwoTitles }}</span></div></section>
          <details ref="mobileRoute" class="w1-mobile-route"><summary>章节目录 · {{ plan.chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1 }} / 7 {{ plan.chapters.find((chapter) => chapter.id === activeChapterId)?.title }}</summary><nav class="w1-route-list" aria-label="W5D3 移动端七章目录"><button v-for="chapter in plan.chapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></nav></details>
          <div class="course-protocol"><span> 多表 SQL 不是孤立结果</span><p>本课只用 W5-多表SQL 教学库建立 `multi-table-sql-log.md`：先写 join_case_id、left_table、right_table、join_type、preserve_rule、join_key、rows_before、rows_after、unique_keys、unmatched_keys、amount_gap、can_prove、cannot_prove 和 next_sql_task。不连接真实数据库、不读取公司数据，也不把教学 JOIN 写成真实生产 JOIN、多表 SQL、归因、趋势或看板可发布。前置不足只提示补学，不锁全文。</p></div>
          <p v-if="announcement" class="announcement" role="status" aria-live="polite">{{ announcement }}</p>

          <div class="manuscript">
            <section v-for="chapter in plan.chapters" :id="`${lesson.id.toLowerCase()}-${chapter.id}`" :key="chapter.id" class="framework-chapter" :data-framework-chapter="chapter.id" tabindex="-1">
              <header class="chapter-head"><div><span>SESSION {{ String(chapter.session).padStart(2, '0') }} · CHAPTER {{ String(chapter.number).padStart(2, '0') }}</span><h2>{{ chapter.title }}</h2><p>{{ chapter.lead }}</p></div><strong>{{ chapter.timeMinutes }} MIN</strong></header>

              <template v-if="chapter.number === 1">
                <div class="scenario-copy"><p><b>你的角色</b>{{ lesson.scenario.role }}</p><p><b>发生了什么</b>{{ lesson.scenario.situation }}</p><blockquote>{{ lesson.scenario.question }}</blockquote><p><b>为什么重要</b>{{ lesson.scenario.stakes }}</p></div>
                <div class="plain-section">
                  <h3>今天先看见对象：多表 SQL图</h3>
                  <p>今天学的是 JOIN 保留规则。先不要做 JOIN 结论，先确认输入行集合和保留侧，再看 NULL 补位、一对多放大和未匹配键。</p>
	                  <div class="system-console" aria-label="多表 SQL样本">
	                    <p class="simulation-label">来自 W5-多表SQL 教学库的 多表 SQL 样本</p>
	                    <table>
                      <thead><tr><th>join_case_id</th><th>join_input_rows</th><th>join_behavior</th><th>join_result</th><th>join_edge</th></tr></thead>
                      <tbody>
                        <tr v-for="row in joinSampleRows" :key="row.join_case_id">
                          <td>{{ row.join_case_id }}</td><td>{{ row.join_input_rows }}</td><td>{{ row.join_behavior }}</td><td>{{ row.join_result }}</td><td>{{ row.join_edge }}</td>
                        </tr>
                      </tbody>
	                    </table>
	                  </div>
	                </div>
	                <div class="plain-section">
	                  <h3>先看一条完整 JOIN ，再拆概念</h3>
                  <p>先看一条能从头到尾解释的多表 SQL，再进入 join_input_rows、join_rule、join_behavior、join_key、join_result 和 join_edge。这样学习者先知道“今天到底在计算什么”，再把字段拆开。</p>
	                  <dl class="stage-ledger">
	                    <div><dt> JOIN 编号</dt><dd>{{ firstCompleteJoinRule.join_case_id }}</dd></div>
	                    <div><dt>口径引用</dt><dd>{{ firstCompleteJoinRule.join_ref }}</dd></div>
	                    <div><dt>输入行</dt><dd>{{ firstCompleteJoinRule.join_input_rows }}</dd></div>
	                    <div><dt>WHERE 规则</dt><dd>{{ firstCompleteJoinRule.join_rule }}</dd></div>
	                    <div><dt> JOIN 函数</dt><dd>{{ firstCompleteJoinRule.join_behavior }}</dd></div>
	                    <div><dt>去重键</dt><dd>{{ firstCompleteJoinRule.join_key }}</dd></div>
	                    <div><dt>结果值</dt><dd>{{ firstCompleteJoinRule.join_result }}</dd></div>
	                    <div><dt>边界样本</dt><dd>{{ firstCompleteJoinRule.join_edge }}</dd></div>
	                    <div><dt>不能证明什么</dt><dd>{{ firstCompleteJoinRule.cannot_prove }}</dd></div>
	                  </dl>
	                </div>
	                <div class="plain-section"><h3>学完后要交出的证据</h3><ol class="objective-list"><li v-for="objective in lesson.objectives" :key="objective.id"><strong>{{ objective.text }}</strong><span>{{ objective.evidence }}</span></li></ol></div>
	                <div class="prerequisite-panel"><div><h3>跨阶段提前观看：提醒，不锁全文</h3><p>即使 W4D4 或前序课程未完成，也可从路线或深链直接阅读完整 W5D3。当前只检查你是否能读懂 W4D4 口径；缺口只限制 `multi-table-sql-log.md` 的实操结论，不隐藏课程。</p></div><fieldset v-for="item in lesson.prerequisites" :key="item.id"><legend>{{ item.prompt }}</legend><p>{{ item.passDescription }}</p><div class="decision-row"><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="pass" :disabled="readonly" @change="updatePrerequisite">已能独立做到</label><label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="remediate" :disabled="readonly" @change="updatePrerequisite">需要先补学</label></div><div v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'" class="remediation"><b>{{ item.remediationLabel }}</b><ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol><a :href="item.remediationTarget">打开补学课程</a></div></fieldset></div>
              </template>

              <div v-if="chapter.number === 2 || chapter.number === 3" class="concept-ledger"><article v-for="concept in conceptsFor(chapter)" :id="`concept-${concept.id}`" :key="concept.id"><header><div><small>{{ concept.english }}</small><h3>{{ concept.term }}</h3></div><span>{{ concept.systemPosition }}</span></header><p class="concept-definition">{{ concept.definition }}</p><div class="concept-why"><p><b>为什么需要它</b>{{ concept.why }}</p><p><b>解决什么问题</b>{{ concept.problemSolved }}</p></div><dl><div><dt>输入</dt><dd>{{ concept.input }}</dd></div><div><dt>输出</dt><dd>{{ concept.output }}</dd></div><div><dt>责任人</dt><dd>{{ concept.owner }}</dd></div><div><dt>不负责</dt><dd>{{ concept.notResponsibleFor }}</dd></div><div><dt>与相邻层比较</dt><dd>{{ concept.compareWith }}</dd></div><div><dt>可观察证据</dt><dd>{{ concept.evidence.join('；') }}</dd></div></dl><ol class="concept-process"><li v-for="step in concept.process" :key="step">{{ step }}</li></ol><p class="pm-use"><b>产品经理怎样用：</b>{{ concept.pmUse }}</p><div class="example-pair"><div><b>正确例子</b>{{ concept.correctExample }}</div><div><b>越界例子</b>{{ concept.incorrectExample }}</div></div></article></div>

              <div v-if="chapter.number === 4" class="understanding-map"><span>join_case_id</span><i>→</i><span>left_table</span><i>→</i><span>right_table</span><i>→</i><span>join_type</span><i>→</i><span>preserve_rule</span><i>→</i><span>join_key</span><i>→</i><span>rows_before</span><i>→</i><span>rows_after</span><i>→</i><span>unique_keys</span><i>→</i><span>unmatched_keys</span><i>→</i><span>amount_gap</span><i>→</i><span>next_sql_task</span><p>先把每条 JOIN 绑定到 W5D3 口径，再用 W5-多表SQL 教学库固定输入表，随后写出保留规则、未匹配键和金额差异。最后用 can_prove、cannot_prove 和 next_sql_task 说明结果能交接到哪里，以及为什么 W5D3 才整理后续 JOIN 计算 SQL。</p></div>

              <template v-if="chapter.number === 5">
                <figure class="relationship-map"><figcaption><strong>{{ lesson.diagram.title }}</strong><span>{{ lesson.diagram.caption }}</span></figcaption><ol><li v-for="node in lesson.diagram.nodes" :key="node.id"><strong>{{ node.label }}</strong><p>{{ node.description }}</p><small>输入：{{ node.input }} · 输出：{{ node.output }}</small></li></ol><ul><li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind"><span>{{ branch.from }}</span><i>→</i><b>{{ branch.label }}</b><i>→</i><span>{{ branch.to }}</span></li></ul><div><b>读图时找这些证据</b><p v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</p></div></figure>
                <div class="demonstration"><h3>{{ lesson.demonstration.title }}</h3><p><b>业务问题：</b>{{ lesson.demonstration.businessProblem }}</p><ol><li v-for="(step, index) in lesson.demonstration.steps" :key="step.title"><span>{{ index + 1 }}</span><div><h4>{{ step.title }}</h4><p><b>教师操作：</b>{{ step.action }}</p><p><b>为什么：</b>{{ step.reason }}</p><p><b>看到：</b>{{ step.evidence }}</p><p><b>能证明：</b>{{ step.proves }}</p><p><b>不能证明：</b>{{ step.limitation }}</p></div></li></ol><div id="demonstration-conclusion" class="limited-conclusion"><p><b>有限结论：</b>{{ lesson.demonstration.finalConclusion }}</p><p><b>结论限制：</b>{{ lesson.demonstration.conclusionLimit }}</p></div></div>
                <div class="lab-panel">
                  <div class="lab-title"><div><span>教学模拟</span><h3>{{ lesson.guidedLab.title }}</h3><p>{{ lesson.guidedLab.goal }}</p></div><small>{{ lesson.guidedLab.safety }}</small></div>
                  <label class="field"><span>先预测</span><small>{{ lesson.guidedLab.predictionPrompt }}</small><textarea v-model="evidence.guidedLab.prediction" rows="3" :readonly="readonly" aria-label="多表 SQL 实验预测" @input="publish" /></label>
                  <div class="system-console">
                    <p class="simulation-label">教学模拟 · 只读取 W5-多表SQL 教学库素材，不调用真实数据库、账号、Token、公司数据或生产系统</p>
                    <label><span>选择一道 JOIN 路径</span><select v-model="evidence.sandbox.ageInput" :disabled="readonly" aria-label="多表 SQL 教学场景" @change="publish"><option v-for="task in joinTasks" :key="task.id" :value="task.id">{{ task.label }}</option></select></label>
                    <dl class="stage-ledger">
                      <div><dt>业务问题</dt><dd>{{ currentJoinRun.businessQuestion }}</dd></div>
                      <div><dt>期望</dt><dd>{{ currentJoinRun.expected }}</dd></div>
                      <div><dt>实际看到什么</dt><dd>{{ currentJoinRun.actual }}</dd></div>
                      <div><dt>能证明什么</dt><dd>{{ currentJoinRun.canProve }}</dd></div>
                      <div><dt>不能证明什么</dt><dd>{{ currentJoinRun.cannotProve }}</dd></div>
                      <div><dt>写入字段</dt><dd>{{ currentJoinRun.field }} · {{ currentJoinRun.metric }}</dd></div>
                      <div><dt>Evidence limit</dt><dd>{{ currentJoinRun.evidenceLimit }}</dd></div>
                    </dl>
                    <p class="first-fork"><b>{{ currentJoinRun.label }}：</b>{{ currentJoinRun.action }}</p>
                    <div class="console-actions"><button type="button" :disabled="readonly" @click="runJoinObserver">运行并追加记录</button><button type="button" class="secondary" :disabled="readonly" @click="resetJoinObserver">全部清空并重做</button></div>
                    <ol v-if="evidence.sandbox.consoleHistory.length" class="exchange-history" aria-label="多表 SQL 教学模拟追加历史"><li v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${entry.command}-${index}`"><code>{{ entry.command }}</code><span>{{ entry.output }}</span></li></ol>
                    <div class="simulation-coverage" aria-label="多表 SQL 实验覆盖"><span v-for="task in joinTasks" :key="task.id" :class="{ done: joinCoverage[task.id] }">{{ task.label }}</span></div>
                  </div>
                  <ol class="lab-steps">
                    <li v-for="task in joinTasks" :key="task.id">
                      <label><input :checked="joinCoverage[task.id]" type="checkbox" disabled><span><b>{{ task.label }}</b>{{ task.action }}</span></label>
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
                  <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeGuidedLab">保存引导实验尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetJoinObserver">全部清空并重做</button></div>
                </div>
              </template>

              <template v-if="chapter.number === 6">
                <div class="boundary-table"><h3>先修常见误判</h3><dl><div><dt>保留规则没先定</dt><dd>先写 INNER、LEFT、RIGHT、FULL 和 preserve_rule，再判断谁被保留。</dd></div><div><dt>把一对多当一对一</dt><dd>orders JOIN order_items 会复制订单级字段；必须先看 rows_before、rows_after 和 unique_keys。</dd></div><div><dt>看到 NULL 就删行</dt><dd>NULL 可能只是外连接补位，不是数据消失。</dd></div><div><dt>把缺口当成不存在</dt><dd>O05 的 user U99 缺失、I08 的 order_id=MISSING 都要被单独列出。</dd></div><div><dt>把 740 当正确 GMV</dt><dd>wrong_gmv=740 只是放大后的错误结果，正确对照线是 440。</dd></div><div><dt>把对账当报告</dt><dd>multi-table-sql-log.md 只能证明对账过程可复核，不能直接证明真实生产结论。</dd></div></dl></div>
                <div class="independent-panel"><h3>{{ lesson.independentLab.title }}</h3><p>{{ lesson.independentLab.scenario }}</p><label><span>改变一个条件</span><select v-model="evidence.independentLab.changedCondition" :disabled="readonly" @change="publish"><option value="">请选择</option><option v-for="item in lesson.independentLab.changedConditions" :key="item" :value="item">{{ item }}</option></select></label><label><span>先预测</span><small>{{ lesson.independentLab.predictionPrompt }}</small><textarea v-model="evidence.independentLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label><label><span>检查计划</span><textarea v-model="evidence.independentLab.plan" rows="5" :readonly="readonly" aria-label="多表 SQL记录 检查计划" @input="publish" /></label><label><span>命令与证据</span><textarea v-model="evidence.independentLab.evidence" rows="5" :readonly="readonly" aria-label="多表 SQL记录 命令证据" @input="publish" /></label><label><span>观察结果</span><textarea v-model="evidence.independentLab.result" rows="3" :readonly="readonly" aria-label="多表 SQL记录 观察结果" @input="publish" /></label><label><span>四句有限结论</span><textarea v-model="evidence.independentLab.conclusion" rows="4" :readonly="readonly" aria-label="多表 SQL记录 有限结论" @input="publish" /></label><div class="check-list"><label v-for="(item, index) in lesson.independentLab.passCriteria" :key="item"><input v-model="evidence.independentLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeIndependentLab">保存独立变式尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetIndependentLab">清空并重做</button></div></div>
              </template>

              <template v-if="chapter.number === 7">
                <div class="practice-workshop"><h3>针对性练习</h3><p>先作答，再看逐项解释；保留规则、连接键、放大点和缺口不能混写，更不能提前声称真实生产 JOIN 已正确。</p><article v-for="(exercise, index) in exerciseSet" :key="exercise.id"><header><span>{{ index + 1 }}</span><div><h4>{{ exercise.prompt }}</h4><small>{{ exercise.categories.join(' · ') }}</small></div></header><div class="answer-options"><label v-for="(option, optionIndex) in exercise.options" :key="option.label"><input v-model="exerciseState(exercise).selectedIndex" type="radio" :name="exercise.id" :value="optionIndex" :disabled="readonly || exerciseState(exercise).submitted" @change="publish"><span>{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option.label }}</label></div><div v-if="exerciseState(exercise).submitted" :class="['exercise-feedback', exerciseState(exercise).selfAssessment]"><b>{{ exerciseState(exercise).selfAssessment === 'pass' ? '当前通过' : '对照后修正' }}</b><p>{{ exercise.referenceAnswer }}</p><ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol><p><b>逐项解释：</b>{{ exercise.options?.map((option) => `${option.label}：${option.rationale}；${option.couldBeTrueWhen}`).join('；') }}</p><p><b>常见错因：</b>{{ exercise.commonErrors.map((item) => `${item.error}：${item.reason}`).join('；') }}</p></div><div class="panel-actions"><button v-if="!exerciseState(exercise).submitted" type="button" :disabled="readonly" @click="submitExercise(exercise)">提交本题</button><button type="button" class="secondary" :disabled="readonly" @click="resetExercise(exercise)">清空并重做</button></div></article></div>
	                <div class="deliverable-panel"><h3>{{ lesson.deliverable.title }}</h3><p>{{ lesson.deliverable.purpose }}</p><p>不要先面对整张验收清单。先按 JOIN 字段逐项生成记录：先写 join_case_id、left_table、right_table 和 join_type，再补 preserve_rule、join_key、rows_before、rows_after、unique_keys、unmatched_keys、amount_gap、can_prove、cannot_prove 和 next_sql_task。</p><div class="field-ledger"><div><b>第 1 步：编号与引用</b><p>join_case_id、left_table、right_table。</p><small>例：J-02；引用 W5-多表SQL 教学库。</small></div><div><b>第 2 步：保留规则与连接键</b><p>join_type、preserve_rule、join_key。</p><small>先写保留哪一边，再写连接键。</small></div><div><b>第 3 步：行数与唯一键</b><p>rows_before、rows_after、unique_keys、unmatched_keys。</p><small>先看行数变化，再把缺口单独列出来。</small></div><div><b>第 4 步：结果与边界</b><p>amount_gap、can_prove、cannot_prove、next_sql_task。</p><small>每条都要承认不能证明真实生产、多表 SQL、归因、趋势、看板发布或 W5D3 已完成。</small></div></div><details open><summary>每条逻辑完成后该补哪些成果字段</summary><ol><li v-for="item in lesson.deliverable.fields" :key="item.name"><b>{{ item.name }}：</b>{{ item.meaning }}；来源：{{ item.source }}</li></ol></details><div class="field-ledger"><div v-for="field in lesson.deliverable.fields" :key="field.name"><b>{{ field.name }}</b><p>{{ field.meaning }}</p><small>证据来源：{{ field.source }}</small></div></div><details><summary>先看一份差稿怎样修正</summary><blockquote>{{ lesson.deliverable.badExample }}</blockquote><p><b>差稿问题：</b>{{ lesson.deliverable.badReasons.join('；') }}</p><ol><li v-for="item in lesson.deliverable.revisionSteps" :key="item">{{ item }}</li></ol><pre>{{ lesson.deliverable.goodExample }}</pre></details><div class="template-actions"><button type="button" :disabled="readonly" @click="useDeliverableTemplate('guided')">使用引导模板</button><button type="button" class="secondary" :disabled="readonly" @click="useDeliverableTemplate('blank')">使用空白模板</button></div><textarea v-model="evidence.deliverable.draft" rows="18" spellcheck="false" :readonly="readonly" :aria-label="`${lesson.deliverable.title} Markdown 草稿`" @input="evidence.deliverable.touched = true; setSectionComplete('deliverable', false); publish()" /><p class="counter">有效实写 {{ deliverableContribution }} / {{ activePath.deliverableMinimumContributionCharacters }} 字符 · 逐题记录字段 {{ deliverableGate.presentFields }}/14 · 非空行 {{ deliverableGate.lineCount }} · 边界门禁 {{ deliverableGate.valid ? '通过' : '待修复' }}</p><div class="simulation-coverage" aria-label="多表 SQL 逐题字段配额"><span v-for="item in deliverableFieldStatus" :key="item.field" :class="{ done: item.done }">{{ item.field }}</span><span :class="{ done: deliverableGate.valid }">{{ deliverableGate.valid ? '多表 SQL valid' : '多表 SQL 待修复' }}</span></div><details v-if="deliverableGate.errors.length" class="remediation"><summary>查看多表 SQL门禁错误（{{ deliverableGate.errors.length }}）</summary><ol><li v-for="error in deliverableGate.errors" :key="error">{{ error }}</li></ol></details><div class="check-list"><label v-for="item in checklistSet" :key="item.index"><input v-model="evidence.deliverable.checklist[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item.item }}</label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeDeliverable">校验并保存完整 多表 SQL 记录</button><button type="button" class="secondary" :disabled="readonly" @click="resetDeliverable">清空并重做</button></div></div>
                <div class="memory-panel"><h3>最终复述与复习排程</h3><div class="check-list"><label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor"><input v-model="evidence.memory.anchorChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ anchor }}</label></div><label><span>闭卷解释</span><small>{{ lesson.memory.closedBookPrompt }}</small><textarea v-model="evidence.memory.closedBook" rows="6" :readonly="readonly" aria-label="W5D3 最终闭卷解释" @input="publish" /></label><label><span>微操作</span><small>{{ lesson.memory.microOperation }}</small><textarea v-model="evidence.memory.microOperation" rows="3" :readonly="readonly" aria-label="W5D3 记忆微操作" @input="publish" /></label><label><span>仍未解决的问题</span><small>{{ lesson.memory.unresolvedPrompt }}</small><textarea v-model="evidence.memory.unresolved" rows="3" :readonly="readonly" aria-label="W5D3 未解决问题" @input="publish" /></label><div class="review-timeline"><label v-for="(stage, index) in lesson.memory.reviewStages" :key="stage.stage"><input v-model="evidence.memory.reviewChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish"><b>{{ stage.stage }}</b><span>{{ stage.task }}</span></label></div><div class="panel-actions"><button type="button" :disabled="readonly" @click="completeMemory">保存最终复述与复习计划</button><button type="button" class="secondary" :disabled="readonly" @click="resetMemory">清空并重做</button></div></div>
                <div class="course-completion"><h3>完成核验</h3><p>完成页面不等于掌握；本课只记录已学习、练习通过、待复核复述、实操证据与待审核成果。W5D3 完成后下一步只说明 W5D3 的 JOIN 计算入口，不创建或修改 W5D3 内容。</p><button type="button" :disabled="readonly || !canCompleteCourse" @click="completeCourse">记录本课首学完成</button><button v-if="lesson.nextLesson" type="button" class="secondary" @click="emit('next-lesson-request', { from: lesson.id, to: lesson.nextLesson!.id })">查看下一课说明</button></div>
              </template>

              <div class="chapter-checkpoint"><div class="checkpoint-heading"><div><span>本章小闭环</span><h3>学习、练习、复述分别保存</h3></div><button type="button" class="reset-link" :disabled="readonly" @click="resetChapterCheckpoint(chapter)">清空练习与复述</button></div><button type="button" :class="['learn-toggle', { done: evidence.frameworkChapters[chapter.id].learn }]" :disabled="readonly" :aria-pressed="evidence.frameworkChapters[chapter.id].learn" @click="toggleChapterLearn(chapter)">{{ evidence.frameworkChapters[chapter.id].learn ? '已学习 · 再按撤销' : '标记本章已学习' }}</button><fieldset><legend>{{ chapter.practice.prompt }}</legend><label v-for="(option, index) in chapter.practice.options" :key="option"><input v-model="evidence.frameworkChapters[chapter.id].selectedIndex" type="radio" :name="`${chapter.id}-practice`" :value="index" :disabled="readonly" @change="publish"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</label></fieldset><div class="checkpoint-actions"><button type="button" :disabled="readonly || evidence.frameworkChapters[chapter.id].selectedIndex === null" @click="submitChapterPractice(chapter)">检查本章练习</button><p v-if="evidence.frameworkChapters[chapter.id].selectedIndex !== null" :class="{ passed: evidence.frameworkChapters[chapter.id].practicePassed }">{{ evidence.frameworkChapters[chapter.id].practicePassed ? chapter.practice.explanation : '未通过：回到本章系统阶段、责任与证据边界后重试。' }}</p></div><label class="retell-field"><span>{{ chapter.retellPrompt }}</span><small>量规：{{ chapter.retellRubric.join('；') }}</small><textarea v-model="evidence.frameworkChapters[chapter.id].retell" rows="4" :readonly="readonly" :aria-label="`第 ${chapter.number} 章复述`" @input="onChapterRetellInput(chapter)" /></label><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts > 0 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-feedback">{{ evidence.frameworkChapters[chapter.id].retellAttempts >= 2 ? '第二次仍未通过，对照参考答案重写后再提交。' : '未通过：按量规补齐后再提交；本次先不显示参考答案。' }}</p><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts >= 2 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-answer"><b>参考答案</b>{{ buildRetellReferenceAnswer(chapter) }}</p><div class="checkpoint-footer"><button type="button" :disabled="readonly" @click="submitChapterRetell(chapter)">保存复述为待复核</button><strong>{{ chapterStatusLabel(chapter) }}</strong></div></div>
            </section>
          </div>
        </main>

        <aside class="w1-route" aria-label="W5D3 七章学习路线"><div class="w1-route-head"><strong>七章学习路线</strong><span>{{ progressPercent }}%</span></div><div v-for="session in [1, 2]" :key="session" class="w1-route-group"><strong><span>时段 {{ session }}</span><span>{{ plan.chapters.filter((chapter) => chapter.session === session).length }} 章</span></strong><div class="w1-route-list"><button v-for="chapter in plan.chapters.filter((item) => item.session === session)" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)"><span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span><span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span></button></div></div><div class="w1-route-note"><strong>掌握未判定 · {{ progressPercent }}%</strong><br>当前位置与完成状态分开；清空重做立即撤销对应高亮。</div></aside>
      </div>
    </div>
  </article>
</template>

<style scoped src="./W11D1Day01CourseView.css"></style>
