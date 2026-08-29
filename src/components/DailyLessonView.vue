<script lang="ts">
import type { LessonSectionId as CourseSectionId } from '../course/types'

export type PrerequisiteDecision = '' | 'pass' | 'remediate'
export type SandboxButtonState = 'idle' | 'busy' | 'success'
export type ExerciseSelfAssessment = '' | 'retry' | 'partial' | 'pass'

export interface LessonConsoleEntry {
  command: string
  output: string
  tone: 'normal' | 'success' | 'error'
}

export interface DailyExerciseEvidence {
  selectedIndex: number | null
  response: string
  submitted: boolean
  hintVisible: boolean
  selfAssessment: ExerciseSelfAssessment
  attemptCount: number
  submittedAt?: string
  remediationVisited: boolean
  correctionNote: string
}

export interface DailyLessonEvidenceState {
  schemaVersion: 2
  lessonId: string
  prerequisiteDecisions: Record<string, PrerequisiteDecision>
  visitedConceptIds: string[]
  expandedConceptIds: string[]
  completedSections: CourseSectionId[]
  sandbox: {
    activePanel: 'elements' | 'console'
    previewHeadline: string
    domDraft: string
    domEdits: number
    ageInput: string
    buttonState: SandboxButtonState
    buttonClicks: number
    consoleHistory: LessonConsoleEntry[]
  }
  guidedLab: {
    prediction: string
    stepComplete: Record<string, boolean>
    observations: Record<string, string>
    records: Record<string, string>
    comparison: string
    passChecks: Record<string, boolean>
  }
  independentLab: {
    changedCondition: string
    prediction: string
    plan: string
    evidence: string
    result: string
    conclusion: string
    passChecks: Record<string, boolean>
  }
  exerciseAnswers: Record<string, DailyExerciseEvidence>
  deliverable: {
    draft: string
    touched: boolean
    templateKind: 'guided' | 'blank'
    checklist: Record<string, boolean>
  }
  memory: {
    anchorChecks: Record<string, boolean>
    closedBook: string
    microOperation: string
    unresolved: string
    reviewChecks: Record<string, boolean>
  }
  savedAt?: string
  completedAt?: string
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import { countSubstantiveContribution } from '../course/evidenceQuality'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<DailyLessonEvidenceState>
  durationMode?: 30 | 45
  readonly?: boolean
}>(), {
  durationMode: 45,
  readonly: false,
})

const mobileToc = ref<HTMLDetailsElement | null>(null)
const lessonRoot = ref<HTMLElement | null>(null)
const activeSectionId = ref<LessonSectionId>('scenario')
const resetAnnouncement = ref('')
let printOpenState: Array<{ element: HTMLDetailsElement; open: boolean }> = []
let sectionObserver: IntersectionObserver | undefined

const emit = defineEmits<{
  'update:evidenceState': [state: DailyLessonEvidenceState]
  'save-attempt': [payload: { lessonId: string; sectionId: LessonSectionId; state: DailyLessonEvidenceState }]
  'section-complete': [payload: { lessonId: string; sectionId: LessonSectionId }]
  'lesson-complete': [payload: { lessonId: string; completedAt: string; state: DailyLessonEvidenceState }]
  'remediation-request': [payload: { lessonId: string; prerequisiteId: string; label: string; target: string }]
  'next-lesson-request': [payload: { from: string; to: string }]
}>()

const sectionOrder: Array<{ id: LessonSectionId; label: string }> = [
  { id: 'scenario', label: '今日工作场景' },
  { id: 'objectives', label: '今日学习目标' },
  { id: 'prerequisites', label: '前置知识检查' },
  { id: 'concepts', label: '核心概念完整讲解' },
  { id: 'diagram', label: '概念关系图' },
  { id: 'demonstration', label: '从头到尾的完整示范' },
  { id: 'guided-lab', label: '引导式实验' },
  { id: 'independent-lab', label: '独立变式实验' },
  { id: 'exercises', label: '针对性练习' },
  { id: 'feedback', label: '反馈与纠错' },
  { id: 'deliverable', label: '今日成果' },
  { id: 'memory', label: '记忆与复习' },
  { id: 'completion', label: '完成本课' },
]

const learningSectionIds = sectionOrder.filter((section) => section.id !== 'completion').map((section) => section.id)
const activePath = computed(() => props.lesson.learningPaths[String(props.durationMode) as '30' | '45'])
const experimentMode = computed<'frontend' | 'dns' | 'http'>(() => {
  if (props.lesson.id === 'W1D2') return 'dns'
  if (props.lesson.id === 'W1D3') return 'http'
  return 'frontend'
})
const experimentLabel = computed(() => experimentMode.value === 'dns' ? '教学寻址台' : experimentMode.value === 'http' ? '教学 HTTP 观察台' : '教学页面沙盒')
const experimentAddress = computed(() => experimentMode.value === 'dns' ? 'lesson.local/addressing' : experimentMode.value === 'http' ? 'lesson.local/http-observer' : 'lesson.local/frontend-basics')
const experimentInputLabel = computed(() => experimentMode.value === 'dns' ? '域名或 URL' : experimentMode.value === 'http' ? '请求体变量' : '年龄')
const experimentInputPlaceholder = computed(() => experimentMode.value === 'dns' ? '例如 api.example.test' : experimentMode.value === 'http' ? '例如 quantity=2' : '先输入 17，再改为 18')
const experimentInitialHeadline = computed(() => experimentMode.value === 'dns' ? 'api.example.test' : experimentMode.value === 'http' ? 'POST /checkout/preview' : '活动报名年龄门槛')
const exerciseSet = computed(() => props.lesson.exercises.slice(0, activePath.value.exerciseCount))
const guidedStepSet = computed(() => activePath.value.guidedStepIndices.map((index) => ({ step: props.lesson.guidedLab.steps[index], index })).filter((item) => item.step))
const guidedRecordSet = computed(() => activePath.value.guidedRecordIndices.map((index) => ({ prompt: props.lesson.guidedLab.recordPrompts[index], index })).filter((item) => item.prompt))
const deliverablePromptSet = computed(() => props.lesson.deliverable.guidedPrompts.slice(0, activePath.value.deliverablePromptCount))
const deliverableChecklistSet = computed(() => activePath.value.deliverableChecklistIndices.map((index) => ({ item: props.lesson.deliverable.checklist[index], index })).filter((item) => item.item))
const deliverableContributionCharacters = computed(() => countSubstantiveContribution(
  evidence.value.deliverable.draft,
  evidence.value.deliverable.templateKind === 'blank'
    ? props.lesson.deliverable.blankTemplate
    : props.lesson.deliverable.standardTemplate,
))
const consoleInput = ref('')
const consoleMessage = ref('')
const artifactMessage = ref('')
const exerciseMessages = ref<Record<string, string>>({})
let sandboxTimer: number | undefined
let syncingExternalState = false
let expandingDetailsForPrint = false

function createBlankEvidence(lesson: DailyCourse): DailyLessonEvidenceState {
  const exerciseAnswers = Object.fromEntries(lesson.exercises.map((exercise) => [exercise.id, {
    selectedIndex: null,
    response: '',
    submitted: false,
    hintVisible: false,
    selfAssessment: '',
    attemptCount: 0,
    remediationVisited: false,
    correctionNote: '',
  } satisfies DailyExerciseEvidence]))

  return {
    schemaVersion: 2,
    lessonId: lesson.id,
    prerequisiteDecisions: {},
    visitedConceptIds: [],
    expandedConceptIds: [],
    completedSections: [],
    sandbox: {
      activePanel: 'elements',
      previewHeadline: lesson.id === 'W1D2' ? 'api.example.test' : lesson.id === 'W1D3' ? 'POST /checkout/preview' : '活动报名年龄门槛',
      domDraft: lesson.id === 'W1D2' ? 'api.example.test' : lesson.id === 'W1D3' ? 'POST /checkout/preview' : '活动报名年龄门槛',
      domEdits: 0,
      ageInput: '',
      buttonState: 'idle',
      buttonClicks: 0,
      consoleHistory: [],
    },
    guidedLab: {
      prediction: '',
      stepComplete: {},
      observations: {},
      records: {},
      comparison: '',
      passChecks: {},
    },
    independentLab: {
      changedCondition: '',
      prediction: '',
      plan: '',
      evidence: '',
      result: '',
      conclusion: '',
      passChecks: {},
    },
    exerciseAnswers,
    deliverable: {
      draft: lesson.deliverable.standardTemplate,
      touched: false,
      templateKind: 'guided',
      checklist: {},
    },
    memory: {
      anchorChecks: {},
      closedBook: '',
      microOperation: '',
      unresolved: '',
      reviewChecks: {},
    },
  }
}

function normalizeEvidence(source: DeepPartial<DailyLessonEvidenceState> | undefined, lesson: DailyCourse): DailyLessonEvidenceState {
  const blank = createBlankEvidence(lesson)
  if (!source || source.lessonId !== lesson.id) return blank

  const exerciseAnswers = { ...blank.exerciseAnswers }
  Object.entries(source.exerciseAnswers ?? {}).forEach(([id, answer]) => {
    if (!answer || !exerciseAnswers[id]) return
    exerciseAnswers[id] = {
      ...exerciseAnswers[id],
      ...answer,
      selectedIndex: typeof answer.selectedIndex === 'number' ? answer.selectedIndex : null,
    }
  })

  return {
    ...blank,
    ...source,
    schemaVersion: 2,
    lessonId: lesson.id,
    prerequisiteDecisions: { ...blank.prerequisiteDecisions, ...compactRecord(source.prerequisiteDecisions) },
    // Schema 1 treated opening a card as completion. Schema 2 requires an
    // explicit acknowledgement, so old open-state data is not migrated as
    // completed first teaching.
    visitedConceptIds: source.schemaVersion === 2 ? [...(source.visitedConceptIds ?? [])] : [],
    expandedConceptIds: [...(source.expandedConceptIds ?? [])],
    completedSections: [...(source.completedSections ?? [])].filter((id): id is LessonSectionId => sectionOrder.some((section) => section.id === id)),
    sandbox: {
      ...blank.sandbox,
      ...(source.sandbox ?? {}),
      ageInput: String(source.sandbox?.ageInput ?? ''),
      buttonState: source.sandbox?.buttonState === 'busy' ? 'idle' : (source.sandbox?.buttonState ?? 'idle'),
      consoleHistory: [...(source.sandbox?.consoleHistory ?? [])].slice(-8) as LessonConsoleEntry[],
    },
    guidedLab: {
      ...blank.guidedLab,
      ...(source.guidedLab ?? {}),
      stepComplete: compactRecord(source.guidedLab?.stepComplete),
      observations: compactRecord(source.guidedLab?.observations),
      records: compactRecord(source.guidedLab?.records),
      passChecks: compactRecord(source.guidedLab?.passChecks),
    },
    independentLab: {
      ...blank.independentLab,
      ...(source.independentLab ?? {}),
      passChecks: compactRecord(source.independentLab?.passChecks),
    },
    exerciseAnswers,
    deliverable: {
      ...blank.deliverable,
      ...(source.deliverable ?? {}),
      templateKind: source.deliverable?.templateKind === 'blank' ? 'blank' : 'guided',
      checklist: compactRecord(source.deliverable?.checklist),
    },
    memory: {
      ...blank.memory,
      ...(source.memory ?? {}),
      anchorChecks: compactRecord(source.memory?.anchorChecks),
      reviewChecks: compactRecord(source.memory?.reviewChecks),
    },
  }
}

const evidence = ref<DailyLessonEvidenceState>(normalizeEvidence(props.evidenceState, props.lesson))

function invalidateStaleConceptCompletion() {
  const hasAllConceptVisits = props.lesson.concepts.every((concept) => evidence.value.visitedConceptIds.includes(concept.id))
  if (hasAllConceptVisits) return
  evidence.value.completedSections = evidence.value.completedSections.filter((id) => id !== 'concepts' && id !== 'completion')
  delete evidence.value.completedAt
}

invalidateStaleConceptCompletion()

watch(() => props.durationMode, () => {
  const revalidatedSections: LessonSectionId[] = ['guided-lab', 'exercises', 'feedback', 'deliverable', 'completion']
  evidence.value.completedSections = evidence.value.completedSections.filter((id) => !revalidatedSections.includes(id))
  delete evidence.value.completedAt
})

function cloneEvidence(): DailyLessonEvidenceState {
  return JSON.parse(JSON.stringify(evidence.value)) as DailyLessonEvidenceState
}

function serialized(value: unknown) {
  return JSON.stringify(value)
}

function compactRecord<T>(source: Record<string, T | undefined> | undefined): Record<string, T> {
  return Object.fromEntries(
    Object.entries(source ?? {}).filter((entry): entry is [string, T] => entry[1] !== undefined),
  )
}

watch(evidence, () => {
  if (!syncingExternalState) emit('update:evidenceState', cloneEvidence())
}, { deep: true })

watch([() => props.lesson.id, () => props.evidenceState], () => {
  const incoming = normalizeEvidence(props.evidenceState, props.lesson)
  if (serialized(incoming) === serialized(evidence.value)) return
  syncingExternalState = true
  evidence.value = incoming
  invalidateStaleConceptCompletion()
  void nextTick(() => { syncingExternalState = false })
}, { deep: true })

const completedCount = computed(() => evidence.value.completedSections.length)
const completionPercent = computed(() => Math.round((completedCount.value / sectionOrder.length) * 100))
const routeProgress = computed(() => [
  {
    key: 'learn',
    label: '学习',
    completed: ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration']
      .filter((id) => isSectionComplete(id as LessonSectionId)).length,
    total: 6,
  },
  {
    key: 'practice',
    label: '练习',
    completed: ['exercises', 'feedback'].filter((id) => isSectionComplete(id as LessonSectionId)).length,
    total: 2,
  },
  {
    key: 'retell',
    label: '复述',
    completed: isSectionComplete('memory') ? 1 : 0,
    total: 1,
  },
  {
    key: 'lab',
    label: '实操',
    completed: ['guided-lab', 'independent-lab'].filter((id) => isSectionComplete(id as LessonSectionId)).length,
    total: 2,
  },
])
const allPrerequisitesPassed = computed(() => props.lesson.prerequisites.length === 0 || props.lesson.prerequisites.every(
  (item) => evidence.value.prerequisiteDecisions[item.id] === 'pass',
))
const prerequisiteNeedsRemediation = computed(() => props.lesson.prerequisites.some(
  (item) => evidence.value.prerequisiteDecisions[item.id] === 'remediate',
))
const allExercisesSubmitted = computed(() => exerciseSet.value.every(
  (exercise) => evidence.value.exerciseAnswers[exercise.id]?.submitted,
))
const allExerciseFeedbackPassed = computed(() => exerciseSet.value.every(
  (exercise) => evidence.value.exerciseAnswers[exercise.id]?.submitted
    && evidence.value.exerciseAnswers[exercise.id]?.selfAssessment === 'pass',
))
const completedLearningSections = computed(() => learningSectionIds.filter(isSectionComplete))
const canCompleteLesson = computed(() => learningSectionIds.every((sectionId) => isSectionComplete(sectionId) && !sectionRequirement(sectionId)))
const incompleteSections = computed(() => sectionOrder.filter(
  (section) => section.id !== 'completion' && (!isSectionComplete(section.id) || Boolean(sectionRequirement(section.id))),
))
const sandboxAgeValue = computed(() => Number(evidence.value.sandbox.ageInput))
const sandboxAgeState = computed<'empty' | 'invalid' | 'underage' | 'eligible'>(() => {
  const raw = String(evidence.value.sandbox.ageInput).trim()
  if (!raw) return 'empty'
  if (experimentMode.value === 'dns') return /^[a-z0-9.-]+(?:\/[\w/?=&.-]*)?$/i.test(raw) ? 'eligible' : 'invalid'
  if (experimentMode.value === 'http') return /^(?:quantity\s*=\s*\"?\d+\"?|\d+)$/.test(raw) ? 'eligible' : 'invalid'
  if (!Number.isFinite(sandboxAgeValue.value) || sandboxAgeValue.value < 0) return 'invalid'
  return sandboxAgeValue.value >= 18 ? 'eligible' : 'underage'
})
const sandboxButtonDisabled = computed(() => props.readonly || sandboxAgeState.value !== 'eligible' || evidence.value.sandbox.buttonState === 'busy')
const sandboxButtonLabel = computed(() => ({
  idle: experimentMode.value === 'dns' ? '解析并检查入口' : experimentMode.value === 'http' ? '发送教学请求' : '报名',
  busy: experimentMode.value === 'dns' ? '正在解析' : experimentMode.value === 'http' ? '正在等待响应' : '正在提交',
  success: experimentMode.value === 'dns' ? '解析结果已记录' : experimentMode.value === 'http' ? '响应结果已记录' : '报名成功',
})[evidence.value.sandbox.buttonState])
const sandboxStatusText = computed(() => {
  if (evidence.value.sandbox.buttonState === 'busy') return experimentMode.value === 'dns' ? '教学状态：正在查询名称并检查入口' : experimentMode.value === 'http' ? '教学状态：正在生成响应' : '页面状态：正在处理报名点击事件'
  if (evidence.value.sandbox.buttonState === 'success') return experimentMode.value === 'dns' ? '教学状态：已得到解析结果；这不等于页面或业务成功' : experimentMode.value === 'http' ? '教学状态：已返回响应；请联合 Status、Response、Timing 与 Size 阅读' : '页面状态：已显示“报名成功”；这仍只是前端教学模拟反馈'
  if (sandboxAgeState.value === 'empty') return experimentMode.value === 'dns' ? '教学状态：等待输入域名或 URL' : experimentMode.value === 'http' ? '教学状态：等待请求体变量' : '页面状态：请输入年龄；报名按钮当前禁用'
  if (sandboxAgeState.value === 'invalid') return experimentMode.value === 'dns' ? '教学状态：域名或 URL 格式无效' : experimentMode.value === 'http' ? '教学状态：请求体变量格式无效' : '页面状态：年龄必须是大于等于 0 的数字'
  if (experimentMode.value === 'dns') return '教学状态：名称格式有效，可以运行解析模拟'
  if (experimentMode.value === 'http') return '教学状态：请求变量有效，可以发送教学请求'
  if (sandboxAgeState.value === 'underage') return '页面状态：需年满 18 岁；报名按钮当前禁用'
  return '页面状态：前端年龄条件通过；报名按钮当前可用'
})

function sectionDomId(sectionId: LessonSectionId) {
  return `${props.lesson.id.toLowerCase()}-${sectionId}`
}

function isSectionComplete(sectionId: LessonSectionId) {
  return evidence.value.completedSections.includes(sectionId)
}

function isSectionAccessible(sectionId: LessonSectionId) {
  if (['scenario', 'objectives', 'prerequisites'].includes(sectionId)) return true
  if (!allPrerequisitesPassed.value) return false
  if (sectionId === 'feedback') return allExercisesSubmitted.value
  return true
}

function sectionKind(sectionId: LessonSectionId) {
  if (['guided-lab', 'independent-lab'].includes(sectionId)) return '实操'
  if (['exercises', 'feedback'].includes(sectionId)) return '练习'
  if (sectionId === 'deliverable') return '成果'
  if (sectionId === 'memory') return '复述'
  if (sectionId === 'completion') return '核验'
  return '学习'
}

function sectionStatusText(sectionId: LessonSectionId) {
  if (isSectionComplete(sectionId)) return '已完成'
  if (!isSectionAccessible(sectionId)) return '待解锁'
  return '未完成'
}

function observeLessonSections() {
  sectionObserver?.disconnect()
  if (!('IntersectionObserver' in window)) return
  const sectionByElement = new Map<Element, LessonSectionId>()
  sectionOrder.forEach((section) => {
    const element = document.getElementById(sectionDomId(section.id))
    if (element) sectionByElement.set(element, section.id)
  })
  sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((left, right) => Math.abs(left.boundingClientRect.top - 96) - Math.abs(right.boundingClientRect.top - 96))
    const sectionId = visible.length ? sectionByElement.get(visible[0].target) : undefined
    if (sectionId) activeSectionId.value = sectionId
  }, {
    root: null,
    rootMargin: '-80px 0px -58% 0px',
    threshold: [0, 0.08, 0.25, 0.5],
  })
  sectionByElement.forEach((_, element) => sectionObserver?.observe(element))
}

async function scrollToSection(sectionId: LessonSectionId) {
  const targetId = isSectionAccessible(sectionId) ? sectionId : 'prerequisites'
  activeSectionId.value = targetId as LessonSectionId
  if (mobileToc.value?.open) {
    mobileToc.value.open = false
    await nextTick()
  }
  const element = document.getElementById(sectionDomId(targetId as LessonSectionId))
  if (!element) return
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  window.setTimeout(() => element.focus({ preventScroll: true }), reduceMotion ? 0 : 360)
}

async function revealAndScrollToAnchor(anchor: string | undefined, fallbackSection: LessonSectionId) {
  if (!anchor) {
    await scrollToSection(fallbackSection)
    return
  }
  if (mobileToc.value?.open) {
    mobileToc.value.open = false
    await nextTick()
  }
  const target = document.getElementById(anchor.replace(/^#/, ''))
  if (!target) {
    await scrollToSection(fallbackSection)
    return
  }
  let ancestor: HTMLElement | null = target
  while (ancestor) {
    if (ancestor instanceof HTMLDetailsElement) ancestor.open = true
    ancestor = ancestor.parentElement
  }
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  window.setTimeout(() => {
    const focusTarget = target.matches('details') ? target.querySelector<HTMLElement>('summary') : target
    focusTarget?.focus({ preventScroll: true })
  }, reduceMotion ? 0 : 360)
}

function sectionRequirement(sectionId: LessonSectionId): string {
  if (sectionId === 'prerequisites' && !allPrerequisitesPassed.value) return '请先把每项前置能力标记为“已能做到”。'
  if (sectionId === 'concepts') {
    const unreadCount = props.lesson.concepts.filter((concept) => !evidence.value.visitedConceptIds.includes(concept.id)).length
    if (unreadCount) return `还需逐张阅读并点击卡内按钮，确认 ${unreadCount} 个完整概念已完成首学；${props.lesson.coreConceptGroups.length} 组概览不替代首次教学。`
  }
  if (sectionId === 'guided-lab') {
    const lab = evidence.value.guidedLab
    if (!lab.prediction.trim()) return '先写下预测，再开始操作。'
    const normalizedCommands = evidence.value.sandbox.consoleHistory
      .filter((entry) => entry.tone !== 'error')
      .map((entry) => entry.command.trim().replace(/;$/, '').toLowerCase())
    const hasDomRead = experimentMode.value === 'frontend'
      ? normalizedCommands.some((command) => command.includes("queryselector('h1')") || command.includes('queryselector("h1")'))
      : experimentMode.value === 'dns'
        ? normalizedCommands.some((command) => command.includes('resolve(') || command.includes('dns.lookup'))
        : normalizedCommands.some((command) => command.includes('request(') || command.includes('fetch('))
    const hasStateRead = normalizedCommands.some((command) => command === 'state.status')
    const hasEventCommand = normalizedCommands.some((command) => command === 'button.click()' || command.includes("queryselector('button')") || command.includes('queryselector("button")'))
    if (evidence.value.sandbox.domEdits < 1 || evidence.value.sandbox.buttonClicks < 1 || !hasDomRead || !hasStateRead || !hasEventCommand) {
      return experimentMode.value === 'frontend'
        ? '请先在教学沙盒中完成 DOM 修改，并用安全 Console 读取标题、触发按钮事件、读取页面状态。'
        : experimentMode.value === 'dns'
          ? '请先编辑解析目标，运行 resolve(...)、触发解析按钮并读取 state.status。'
          : '请先编辑请求变量，运行 request(...)、触发发送按钮并读取 state.status。'
    }
    if (guidedStepSet.value.some(({ index }) => !lab.stepComplete[`step-${index}`] || !lab.observations[`step-${index}`]?.trim())) return '请完成当前学习路径中的每一步，并记录实际观察。'
    if (guidedRecordSet.value.some(({ index }) => !lab.records[`record-${index}`]?.trim())) return '请补全当前学习路径中的实验记录。'
    if (!lab.comparison.trim()) return '请比较预测与实际结果。'
    if (props.lesson.guidedLab.passCriteria.some((_, index) => !lab.passChecks[`pass-${index}`])) return '请逐项核对通过标准。'
  }
  if (sectionId === 'independent-lab') {
    const lab = evidence.value.independentLab
    if (props.lesson.independentLab.changedConditions.length && !lab.changedCondition) return '请选择本次变式条件。'
    if (lab.prediction.trim().length < 8) return '先写下不少于 8 个字符的独立预测，再开始操作。'
    if (![lab.plan, lab.evidence, lab.result, lab.conclusion].every((value) => value.trim().length >= 8)) return '操作计划、证据、结果与结论每项都需不少于 8 个字符。'
    if (props.lesson.independentLab.passCriteria.some((_, index) => !lab.passChecks[`pass-${index}`])) return '请逐项核对独立实验标准。'
  }
  if (sectionId === 'exercises') {
    if (!allExercisesSubmitted.value) return `请逐题提交当前路径的 ${exerciseSet.value.length} 道练习。`
  }
  if (sectionId === 'feedback') {
    if (!allExercisesSubmitted.value) return '先在第 9 节提交当前路径的全部练习，才能进入反馈与纠错。'
    const uncalibrated = exerciseSet.value.filter((exercise) => !evidence.value.exerciseAnswers[exercise.id]?.selfAssessment)
    if (uncalibrated.length) return `还有 ${uncalibrated.length} 道题尚未完成答案校准。`
    const needsRevision = exerciseSet.value.filter((exercise) => evidence.value.exerciseAnswers[exercise.id]?.selfAssessment !== 'pass')
    if (needsRevision.length) return `还有 ${needsRevision.length} 道题需要先补学、写明修正点，再重新作答到通过状态。`
    if (!allExerciseFeedbackPassed.value) return '每道题都必须完成反馈校准并形成可通过的最终回答。'
  }
  if (sectionId === 'deliverable') {
    if (!evidence.value.deliverable.touched || deliverableContributionCharacters.value < activePath.value.deliverableMinimumContributionCharacters) return `请在模板之外写入不少于 ${activePath.value.deliverableMinimumContributionCharacters} 个有效字符；当前为 ${deliverableContributionCharacters.value}。`
    if (deliverableChecklistSet.value.some(({ index }) => !evidence.value.deliverable.checklist[`item-${index}`])) return '请逐项完成当前路径的成果自检；这些勾选只用于检查完整性，不会直接提高掌握等级。'
  }
  if (sectionId === 'memory') {
    const memory = evidence.value.memory
    if (props.lesson.memory.anchors.some((_, index) => !memory.anchorChecks[`anchor-${index}`])) return '请确认每条记忆锚点。'
    if (memory.closedBook.trim().length < 40) return '闭卷解释需不少于 40 个字符，写清定义、证据和边界。'
    if (![memory.microOperation, memory.unresolved].every((value) => value.trim())) return '请完成微操作和未解决问题。'
    if (props.lesson.memory.reviewStages.some((stage) => !memory.reviewChecks[stage.stage])) return '请安排所有复习阶段。'
  }
  if (sectionId === 'completion' && !canCompleteLesson.value) return `还有 ${incompleteSections.value.length} 节未完成。`
  return ''
}

function toggleSectionComplete(sectionId: LessonSectionId) {
  if (props.readonly) return
  const index = evidence.value.completedSections.indexOf(sectionId)
  if (index >= 0) {
    evidence.value.completedSections.splice(index, 1)
    if (sectionId !== 'completion') {
      evidence.value.completedSections = evidence.value.completedSections.filter((id) => id !== 'completion')
      delete evidence.value.completedAt
    }
    return
  }
  if (sectionRequirement(sectionId)) return
  evidence.value.completedSections.push(sectionId)
  emit('section-complete', { lessonId: props.lesson.id, sectionId })
  if (sectionId === 'completion') {
    const completedAt = new Date().toISOString()
    evidence.value.completedAt = completedAt
    emit('lesson-complete', { lessonId: props.lesson.id, completedAt, state: cloneEvidence() })
  }
  saveSection(sectionId)
}

function saveSection(sectionId: LessonSectionId) {
  evidence.value.savedAt = new Date().toISOString()
  emit('save-attempt', { lessonId: props.lesson.id, sectionId, state: cloneEvidence() })
}

function requestRemediation(prerequisiteId: string, label: string, target: string) {
  revealAndScrollToAnchor(target, 'prerequisites')
  emit('remediation-request', { lessonId: props.lesson.id, prerequisiteId, label, target })
}

function onConceptToggle(event: Event, conceptId: string) {
  if (expandingDetailsForPrint) return
  const open = (event.currentTarget as HTMLDetailsElement).open
  const ids = evidence.value.expandedConceptIds.filter((id) => id !== conceptId)
  if (open) ids.push(conceptId)
  evidence.value.expandedConceptIds = ids
}

function toggleConceptStudied(conceptId: string) {
  if (props.readonly) return
  const completed = evidence.value.visitedConceptIds.includes(conceptId)
  evidence.value.visitedConceptIds = completed
    ? evidence.value.visitedConceptIds.filter((id) => id !== conceptId)
    : [...evidence.value.visitedConceptIds, conceptId]
  if (completed) {
    evidence.value.completedSections = evidence.value.completedSections.filter((id) => id !== 'concepts' && id !== 'completion')
    delete evidence.value.completedAt
  }
}

function nodeLabel(nodeId: string) {
  return props.lesson.diagram.nodes.find((node) => node.id === nodeId)?.label ?? nodeId
}

function applyDomEdit() {
  if (props.readonly) return
  const next = evidence.value.sandbox.domDraft.trim()
  if (!next) return
  evidence.value.sandbox.previewHeadline = next.slice(0, 80)
  evidence.value.sandbox.domEdits += 1
  artifactMessage.value = experimentMode.value === 'frontend'
    ? '页面中的标题节点已更新。刷新真实网页通常会恢复原内容。'
    : experimentMode.value === 'dns'
      ? '解析目标已更新。真实 DNS 记录不会因教学台输入而改变。'
      : '请求体变量已更新。教学台不会发送真实业务请求。'
}

function onEditableHeadline(event: Event) {
  if (props.readonly) return
  const text = (event.currentTarget as HTMLElement).innerText.trim().slice(0, 80)
  if (text && text !== evidence.value.sandbox.previewHeadline) evidence.value.sandbox.domEdits += 1
  evidence.value.sandbox.previewHeadline = text
  evidence.value.sandbox.domDraft = text
}

function triggerSandboxButton() {
  if (sandboxButtonDisabled.value) return
  if (sandboxTimer) window.clearTimeout(sandboxTimer)
  evidence.value.sandbox.buttonClicks += 1
  evidence.value.sandbox.buttonState = 'busy'
  sandboxTimer = window.setTimeout(() => {
    evidence.value.sandbox.buttonState = 'success'
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 720)
}

function resetSandboxState() {
  if (props.readonly) return
  if (sandboxTimer) window.clearTimeout(sandboxTimer)
  evidence.value.sandbox.ageInput = ''
  evidence.value.sandbox.previewHeadline = experimentInitialHeadline.value
  evidence.value.sandbox.domDraft = experimentInitialHeadline.value
  evidence.value.sandbox.buttonState = 'idle'
}

function updateSandboxAge() {
  if (evidence.value.sandbox.buttonState !== 'idle') evidence.value.sandbox.buttonState = 'idle'
}

function pushConsoleEntry(command: string, output: string, tone: LessonConsoleEntry['tone'] = 'normal') {
  evidence.value.sandbox.consoleHistory.push({ command, output, tone })
  evidence.value.sandbox.consoleHistory = evidence.value.sandbox.consoleHistory.slice(-8)
}

function calculateSafeArithmetic(command: string): string | null {
  const comparison = command.match(/^(-?\d+(?:\.\d+)?)\s*(>=|<=|>|<|===|==)\s*(-?\d+(?:\.\d+)?)$/)
  if (comparison) {
    const left = Number(comparison[1])
    const right = Number(comparison[3])
    const operator = comparison[2]
    return String(operator === '>=' ? left >= right : operator === '<=' ? left <= right : operator === '>' ? left > right : operator === '<' ? left < right : left === right)
  }
  const strings = command.match(/^(['"])(.*)\1\s*\+\s*(['"])(.*)\3$/)
  if (strings) return `${strings[2]}${strings[4]}`
  const match = command.match(/^(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/)
  if (!match) return null
  const left = Number(match[1])
  const right = Number(match[3])
  const operator = match[2]
  if (operator === '/' && right === 0) return 'Infinity（除数为 0）'
  const value = operator === '+' ? left + right : operator === '-' ? left - right : operator === '*' ? left * right : left / right
  return String(Number(value.toFixed(8)))
}

function runConsole(commandOverride?: string) {
  if (props.readonly) return
  const raw = (commandOverride ?? consoleInput.value).trim().replace(/;$/, '')
  if (!raw) return
  let output = ''
  let tone: LessonConsoleEntry['tone'] = 'normal'
  const arithmetic = calculateSafeArithmetic(raw)
  const assignment = raw.match(/^document\.querySelector\(['"]h1['"]\)\.textContent\s*=\s*(['"])(.{1,80})\1$/)

  if (arithmetic !== null) output = arithmetic
  else if (/^document\.title$/i.test(raw)) output = experimentLabel.value
  else if (/^document\.querySelector\(['"]h1['"]\)\.textContent$/i.test(raw)) output = evidence.value.sandbox.previewHeadline
  else if (/^(resolve|dns\.lookup)\(['"][^'"]+['"]\)$/i.test(raw) && experimentMode.value === 'dns') {
    const target = raw.match(/['"]([^'"]+)['"]/i)?.[1] ?? evidence.value.sandbox.ageInput
    output = target.includes('missing') ? 'NXDOMAIN（教学模拟）' : '203.0.113.18 · TTL 60s（教学模拟）'
    tone = target.includes('missing') ? 'error' : 'success'
  } else if ((/^request\(['"][^'"]+['"]\)$/i.test(raw) || raw === 'request-type-error') && experimentMode.value === 'http') {
    const payload = raw.match(/['"]([^'"]+)['"]/i)?.[1] ?? ''
    const typeError = raw === 'request-type-error' || payload.includes('"')
    output = typeError ? '422 · INVALID_TYPE · 416 B（教学模拟）' : '200 · preview=¥128 · 2 KB（教学模拟）'
    tone = typeError ? 'error' : 'success'
  }
  else if (/^document\.querySelector\(['"]button['"]\)\.textContent$/i.test(raw)) output = sandboxButtonLabel.value
  else if (/^(button|document\.querySelector\(['"]button['"]\))\.click\(\)$/i.test(raw)) {
    if (sandboxButtonDisabled.value) {
      output = experimentMode.value === 'frontend' ? '按钮当前有 disabled：先把年龄改为 18，再触发 click。' : '按钮当前不可用：先输入有效的教学实验变量，再触发 click。'
      tone = 'error'
    } else {
      triggerSandboxButton()
      output = '已触发 click 事件；请观察左侧按钮和页面状态。'
      tone = 'success'
    }
  } else if (/^state\.status$/i.test(raw)) output = `${experimentInputLabel.value}:${sandboxAgeState.value}; submit:${evidence.value.sandbox.buttonState}`
  else if (assignment) {
    evidence.value.sandbox.previewHeadline = assignment[2]
    evidence.value.sandbox.domDraft = assignment[2]
    evidence.value.sandbox.domEdits += 1
    output = assignment[2]
    tone = 'success'
  } else if (/^help$/i.test(raw)) {
    output = experimentMode.value === 'dns'
      ? "可用：resolve('api.example.test')、resolve('missing.example.test')、document.title、button.click()、state.status"
      : experimentMode.value === 'http'
        ? "可用：request('quantity=2')、request('quantity=\"2\"')、document.title、button.click()、state.status"
        : "可用：1 + 1、17 >= 18、\"产品\" + \"技术\"、document.title、document.querySelector('h1').textContent、button.click()、state.status"
  } else {
    output = '这条命令未运行。沙盒只支持上方列出的安全命令，不会执行任意代码。'
    tone = 'error'
  }

  pushConsoleEntry(raw, output, tone)
  consoleInput.value = ''
  consoleMessage.value = tone === 'error' ? '命令未执行，请选择一条课程示例。' : '命令已在本地教学沙盒中运行。'
}

function exerciseDraft(exerciseId: string): DailyExerciseEvidence {
  if (!evidence.value.exerciseAnswers[exerciseId]) {
    evidence.value.exerciseAnswers[exerciseId] = {
      selectedIndex: null,
      response: '',
      submitted: false,
      hintVisible: false,
      selfAssessment: '',
      attemptCount: 0,
      remediationVisited: false,
      correctionNote: '',
    }
  }
  return evidence.value.exerciseAnswers[exerciseId]
}

function exerciseKindLabel(exercise: Exercise) {
  return exercise.kind === 'single-choice' ? '单项选择' : exercise.kind === 'ordering' ? '顺序推演' : '开放回答'
}

function submitExercise(exercise: Exercise) {
  if (props.readonly) return
  const draft = exerciseDraft(exercise.id)
  const missing = exercise.kind === 'single-choice' ? draft.selectedIndex === null : !draft.response.trim()
  if (missing) {
    exerciseMessages.value[exercise.id] = '请先完成作答，再查看反馈。'
    return
  }
  draft.attemptCount += 1
  draft.submittedAt = new Date().toISOString()
  draft.submitted = true
  draft.remediationVisited = false
  draft.correctionNote = ''
  if (exercise.kind === 'single-choice') {
    draft.selfAssessment = draft.selectedIndex === exercise.answerIndex ? 'pass' : 'retry'
  } else {
    draft.selfAssessment = ''
  }
  evidence.value.completedSections = evidence.value.completedSections.filter((id) => id !== 'feedback' && id !== 'completion')
  delete evidence.value.completedAt
  exerciseMessages.value[exercise.id] = '已锁定本次回答。提交完本节全部题目后，到第 10 节统一查看反馈与纠错。'
  saveSection('exercises')
}

function exerciseNeedsCorrection(exercise: Exercise) {
  const draft = exerciseDraft(exercise.id)
  return draft.submitted && Boolean(draft.selfAssessment) && draft.selfAssessment !== 'pass'
}

function exerciseCorrectionReady(exercise: Exercise) {
  const draft = exerciseDraft(exercise.id)
  return draft.remediationVisited && draft.correctionNote.trim().length >= 12
}

function setExerciseSelfAssessment(exercise: Exercise, assessment: Exclude<ExerciseSelfAssessment, ''>) {
  if (props.readonly) return
  const draft = exerciseDraft(exercise.id)
  if (!draft.submitted || draft.selfAssessment) return
  draft.selfAssessment = assessment
  exerciseMessages.value[exercise.id] = assessment === 'pass'
    ? '已完成自我校准；这只表示页面纠错完成，开放题仍需量规或他人复核。'
    : '请先返回补学位置核对，再写下这次需要修正的关键点，然后重新作答。'
  saveSection('feedback')
}

function visitExerciseRemediation(exercise: Exercise) {
  if (!props.readonly) {
    exerciseDraft(exercise.id).remediationVisited = true
    saveSection('feedback')
  }
  revealAndScrollToAnchor(exercise.remediation.anchor, exercise.remediation.sectionId)
}

function retryExercise(exercise: Exercise) {
  if (props.readonly) return
  const draft = exerciseDraft(exercise.id)
  if (exerciseNeedsCorrection(exercise) && !exerciseCorrectionReady(exercise)) {
    exerciseMessages.value[exercise.id] = '先打开补学位置，并用不少于 12 个字符写清原答案错在哪里、这次准备怎样修正。'
    return
  }
  saveSection('feedback')
  draft.submitted = false
  draft.selectedIndex = null
  draft.response = ''
  draft.selfAssessment = ''
  draft.remediationVisited = false
  draft.correctionNote = ''
  evidence.value.completedSections = evidence.value.completedSections.filter((id) => !['exercises', 'feedback', 'completion'].includes(id))
  delete evidence.value.completedAt
  exerciseMessages.value[exercise.id] = '已返回独立作答状态。请带着刚才的修正点重新完成本题。'
}

function finishDraftReset(sectionIds: LessonSectionId[], message: string) {
  evidence.value.completedSections = evidence.value.completedSections.filter((id) => !sectionIds.includes(id))
  delete evidence.value.completedAt
  evidence.value.savedAt = new Date().toISOString()
  resetAnnouncement.value = message
}

function resetGuidedLab() {
  if (props.readonly) return
  if (sandboxTimer) window.clearTimeout(sandboxTimer)
  const blank = createBlankEvidence(props.lesson)
  evidence.value.sandbox = blank.sandbox
  evidence.value.guidedLab = blank.guidedLab
  consoleInput.value = ''
  consoleMessage.value = ''
  artifactMessage.value = ''
  finishDraftReset(['guided-lab', 'completion'], '引导实验已清空，可从预测开始重做；既有正式尝试记录仍保留。')
}

function resetIndependentLab() {
  if (props.readonly) return
  evidence.value.independentLab = createBlankEvidence(props.lesson).independentLab
  finishDraftReset(['independent-lab', 'completion'], '独立变式实验已清空，可重新选择条件并重做；既有正式尝试记录仍保留。')
}

function resetExercise(exerciseId: string) {
  if (props.readonly) return
  const blank = createBlankEvidence(props.lesson).exerciseAnswers[exerciseId]
  if (!blank) return
  evidence.value.exerciseAnswers[exerciseId] = blank
  delete exerciseMessages.value[exerciseId]
  finishDraftReset(['exercises', 'feedback', 'completion'], '本题已清空并恢复为 0 次当前作答；证据账本中的历史尝试没有删除。')
}

function resetDeliverable() {
  if (props.readonly) return
  evidence.value.deliverable = createBlankEvidence(props.lesson).deliverable
  artifactMessage.value = ''
  finishDraftReset(['deliverable', 'completion'], '今日成果已恢复到初始引导模板；既有正式提交与审核记录仍保留。')
}

function resetMemory() {
  if (props.readonly) return
  evidence.value.memory = createBlankEvidence(props.lesson).memory
  finishDraftReset(['memory', 'completion'], '闭卷复述与复习计划已清空，可以重新完成；既有正式尝试记录仍保留。')
}

function choiceIsCorrect(exercise: Exercise) {
  return exerciseDraft(exercise.id).selectedIndex === exercise.answerIndex
}

function markDeliverableTouched() {
  evidence.value.deliverable.touched = true
}

function switchDeliverableTemplate(templateKind: 'guided' | 'blank') {
  if (props.readonly || evidence.value.deliverable.templateKind === templateKind) return
  const targetTemplate = templateKind === 'blank'
    ? props.lesson.deliverable.blankTemplate
    : props.lesson.deliverable.standardTemplate
  const currentTemplate = evidence.value.deliverable.templateKind === 'blank'
    ? props.lesson.deliverable.blankTemplate
    : props.lesson.deliverable.standardTemplate
  const hasLearnerDraft = evidence.value.deliverable.touched
    || evidence.value.deliverable.draft.trim() !== currentTemplate.trim()
  if (hasLearnerDraft && !window.confirm('切换模板会覆盖当前成果草稿，并清空本节自检与完成状态。是否继续？')) return
  evidence.value.deliverable.draft = targetTemplate
  evidence.value.deliverable.templateKind = templateKind
  evidence.value.deliverable.touched = false
  evidence.value.deliverable.checklist = {}
  evidence.value.completedSections = evidence.value.completedSections.filter((id) => id !== 'deliverable' && id !== 'completion')
  delete evidence.value.completedAt
  artifactMessage.value = templateKind === 'blank'
    ? '已切换到空白独立练习版；标题只提供结构，不计入有效正文。'
    : '已切换到引导模板；请替换字段后的占位内容。'
}

async function copyDeliverable() {
  const text = evidence.value.deliverable.draft.trim()
  if (!text) {
    artifactMessage.value = '成果还是空的，请先完成内容。'
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    artifactMessage.value = '今日成果已复制到剪贴板。'
  } catch {
    artifactMessage.value = '浏览器未开放剪贴板权限，请使用“下载成果”。'
  }
}

function downloadDeliverable() {
  const text = evidence.value.deliverable.draft.trim()
  if (!text) {
    artifactMessage.value = '成果还是空的，请先完成内容。'
    return
  }
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${props.lesson.id}-${props.lesson.deliverable.title}.txt`.replace(/[\\/:*?"<>|]/g, '-')
  anchor.click()
  URL.revokeObjectURL(url)
  artifactMessage.value = '今日成果已下载为本地文本文件。'
}

function saveDeliverable() {
  evidence.value.deliverable.touched = true
  artifactMessage.value = sectionRequirement('deliverable') || '成果已交给父页面保存。'
  saveSection('deliverable')
}

function requestNextLesson() {
  if (props.lesson.nextLesson) emit('next-lesson-request', { from: props.lesson.id, to: props.lesson.nextLesson.id })
}

function expandDetailsForPrint() {
  expandingDetailsForPrint = true
  const details = Array.from(lessonRoot.value?.querySelectorAll<HTMLDetailsElement>('details') ?? [])
  printOpenState = details.map((element) => ({ element, open: element.open }))
  details.forEach((element) => { element.open = true })
}

function restoreDetailsAfterPrint() {
  printOpenState.forEach(({ element, open }) => { element.open = open })
  printOpenState = []
  void nextTick(() => { expandingDetailsForPrint = false })
}

onMounted(() => {
  window.addEventListener('beforeprint', expandDetailsForPrint)
  window.addEventListener('afterprint', restoreDetailsAfterPrint)
  observeLessonSections()
})

onBeforeUnmount(() => {
  if (sandboxTimer) window.clearTimeout(sandboxTimer)
  sectionObserver?.disconnect()
  window.removeEventListener('beforeprint', expandDetailsForPrint)
  window.removeEventListener('afterprint', restoreDetailsAfterPrint)
})
</script>

<template>
  <article ref="lessonRoot" class="daily-lesson" :aria-labelledby="`${lesson.id}-title`">
    <header class="lesson-cover">
      <div class="lesson-title-block">
        <h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1>
        <p class="lesson-subtitle">{{ lesson.subtitle }}</p>
        <p class="lesson-code">{{ lesson.id }} · 内容版本 {{ lesson.contentVersion }}</p>
      </div>
      <dl class="lesson-facts">
        <div>
          <dt>当前路径</dt>
          <dd>{{ durationMode }} 分钟 · 本次专注时段</dd>
        </div>
        <div>
          <dt>完整首学</dt>
          <dd>设计估算约 {{ lesson.duration.full }} 分钟 · 可跨多个时段，{{ lesson.concepts.length }} 个完整概念和 {{ lesson.demonstration.steps.length }} 步示范都是必修</dd>
        </div>
        <div>
          <dt>可验证目标</dt>
          <dd>{{ lesson.primaryGoal }}</dd>
        </div>
      </dl>
      <div class="cover-progress">
        <div>
          <strong>{{ completedLearningSections.length }}/{{ learningSectionIds.length }} 教学段</strong>
          <span>{{ completionPercent }}%</span>
        </div>
        <progress :value="completedCount" :max="sectionOrder.length">
          已完成 {{ completedCount }} 节，共 {{ sectionOrder.length }} 节
        </progress>
      </div>
    </header>

    <details ref="mobileToc" class="mobile-toc">
      <summary>打开本课目录 · {{ completedCount }}/{{ sectionOrder.length }}</summary>
      <nav aria-label="本课移动目录">
        <div class="mobile-route-progress" aria-label="本课独立学习状态">
          <span v-for="item in routeProgress" :key="item.key">{{ item.label }} {{ item.completed }}/{{ item.total }}</span>
        </div>
        <button
          v-for="(section, index) in sectionOrder"
          :key="section.id"
          type="button"
          :class="{ complete: isSectionComplete(section.id), current: activeSectionId === section.id }"
          :aria-current="activeSectionId === section.id ? 'location' : undefined"
          :aria-label="`${section.label}，${sectionKind(section.id)}：${sectionStatusText(section.id)}`"
          :disabled="!isSectionAccessible(section.id)"
          @click="scrollToSection(section.id)"
        >
          <span>{{ section.id === 'completion' ? '核' : index + 1 }}</span>
          {{ section.label }}
          <small>{{ sectionKind(section.id) }} · {{ sectionStatusText(section.id) }}</small>
        </button>
      </nav>
    </details>

    <p v-if="resetAnnouncement" id="lesson-reset-announcement" class="reset-announcement" role="status" aria-live="polite">{{ resetAnnouncement }}</p>

    <div class="lesson-layout">
      <div class="lesson-manuscript">
        <section
          :id="sectionDomId('scenario')"
          class="lesson-section scenario-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-scenario-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">1</span>
            <h2 :id="`${lesson.id}-scenario-title`">今日工作场景</h2>
            <span class="section-state">{{ isSectionComplete('scenario') ? '已完成' : '待学习' }}</span>
          </div>
          <div class="scenario-brief">
            <p><strong>你是谁：</strong>{{ lesson.scenario.role }}</p>
            <p><strong>发生了什么：</strong>{{ lesson.scenario.situation }}</p>
            <blockquote>{{ lesson.scenario.question }}</blockquote>
            <p><strong>为什么重要：</strong>{{ lesson.scenario.stakes }}</p>
          </div>
          <div class="section-action">
            <button class="secondary-button" type="button" :disabled="readonly" @click="toggleSectionComplete('scenario')">
              {{ isSectionComplete('scenario') ? '撤销本节完成' : '我理解今天要解决的问题' }}
            </button>
          </div>
        </section>

        <section
          :id="sectionDomId('objectives')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-objectives-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">2</span>
            <h2 :id="`${lesson.id}-objectives-title`">今日学习目标</h2>
            <span class="section-state">{{ isSectionComplete('objectives') ? '已完成' : '待验证' }}</span>
          </div>
          <p class="section-intro">学完后，不用“了解”来证明进步，而要交出下面这些可观察证据。</p>
          <ol class="objective-list">
            <li v-for="objective in lesson.objectives" :key="objective.id">
              <strong>{{ objective.text }}</strong>
              <span>完成证据：{{ objective.evidence }}</span>
            </li>
          </ol>
          <div class="section-action">
            <button class="secondary-button" type="button" :disabled="readonly" @click="toggleSectionComplete('objectives')">
              {{ isSectionComplete('objectives') ? '撤销本节完成' : '我知道今天如何证明学会' }}
            </button>
          </div>
        </section>

        <section
          :id="sectionDomId('prerequisites')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-prerequisites-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">3</span>
            <h2 :id="`${lesson.id}-prerequisites-title`">前置知识检查</h2>
            <span class="section-state">{{ allPrerequisitesPassed ? '可以继续' : '需要确认' }}</span>
          </div>
          <p class="section-intro">逐项判断自己是否能独立做到。选择“需要补课”不会扣分，它是在阻止知识断层。</p>
          <div v-if="lesson.prerequisites.length" class="prerequisite-list">
            <fieldset v-for="item in lesson.prerequisites" :key="item.id">
              <legend>{{ item.prompt }}</legend>
              <p>{{ item.passDescription }}</p>
              <div class="decision-row">
                <label :class="{ selected: evidence.prerequisiteDecisions[item.id] === 'pass' }">
                  <input
                    v-model="evidence.prerequisiteDecisions[item.id]"
                    type="radio"
                    :name="`${lesson.id}-${item.id}`"
                    value="pass"
                    :disabled="readonly"
                  >
                  已能独立做到
                </label>
                <label :class="{ selected: evidence.prerequisiteDecisions[item.id] === 'remediate' }">
                  <input
                    v-model="evidence.prerequisiteDecisions[item.id]"
                    type="radio"
                    :name="`${lesson.id}-${item.id}`"
                    value="remediate"
                    :disabled="readonly"
                  >
                  需要先补课
                </label>
              </div>
              <button
                v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'"
                class="text-button"
                type="button"
                @click="requestRemediation(item.id, item.remediationLabel, item.remediationTarget)"
              >
                {{ item.remediationLabel }}
              </button>
              <details
                :id="item.remediationTarget.replace(/^#/, '')"
                class="prerequisite-remediation"
                :open="evidence.prerequisiteDecisions[item.id] === 'remediate'"
              >
                <summary>{{ item.remediationLabel }}</summary>
                <p>{{ item.remediation.purpose }}</p>
                <ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol>
                <p><strong>完成标准：</strong>{{ item.remediation.successCheck }}</p>
              </details>
            </fieldset>
          </div>
          <p v-else class="empty-note">这是起点课程，没有必须先掌握的技术概念，可以直接继续。</p>
          <div
            class="readiness-message"
            :class="{ ready: allPrerequisitesPassed, warning: prerequisiteNeedsRemediation }"
            role="status"
            aria-live="polite"
          >
            <strong v-if="allPrerequisitesPassed">前置能力已确认，后续正文已开放。</strong>
            <strong v-else-if="prerequisiteNeedsRemediation">先使用补课入口，完成后再回来重新确认。</strong>
            <strong v-else>完成所有判断后，核心正文才会开放。</strong>
          </div>
          <div class="section-action">
            <p v-if="sectionRequirement('prerequisites')">{{ sectionRequirement('prerequisites') }}</p>
            <button
              class="primary-button"
              type="button"
              :disabled="readonly || !!sectionRequirement('prerequisites')"
              @click="toggleSectionComplete('prerequisites')"
            >
              {{ isSectionComplete('prerequisites') ? '撤销本节完成' : '确认前置并开始正文' }}
            </button>
          </div>
        </section>

        <section
          :id="sectionDomId('concepts')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-concepts-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">4</span>
            <h2 :id="`${lesson.id}-concepts-title`">核心概念完整讲解</h2>
            <span class="section-state">{{ isSectionComplete('concepts') ? '已完成' : '逐个首学' }}</span>
          </div>
          <div v-if="allPrerequisitesPassed">
            <p class="section-intro">先用 {{ lesson.coreConceptGroups.length }} 组概念主干建立全局关系，再逐张阅读 {{ lesson.concepts.length }} 个完整概念，并在卡内点击首学确认。概览不替代完整正文；首学确认只记录进度，不会提高掌握等级。</p>
            <div class="core-concept-groups">
              <article v-for="group in lesson.coreConceptGroups" :key="group.id">
                <h3>{{ group.title }}</h3>
                <p>{{ group.summary }}</p>
                <small><strong>证据边界：</strong>{{ group.boundary }}</small>
              </article>
            </div>
            <details class="extension-reading">
              <summary>完整概念首学 · {{ lesson.concepts.length }} 张必修概念卡</summary>
              <p>每张都包含定义、必要性、输入输出、工作过程、责任边界、证据、失败模式与正反例。可分次学习；只有逐张阅读并点击卡内确认后，本节才允许完成。</p>
            <div class="concept-list">
              <details
                v-for="concept in lesson.concepts"
                :key="concept.id"
                :id="`concept-${concept.id}`"
                :open="evidence.expandedConceptIds.includes(concept.id)"
                tabindex="-1"
                @toggle="onConceptToggle($event, concept.id)"
              >
                <summary>
                  <span>
                    <strong>{{ concept.term }}</strong>
                    <small v-if="concept.english">{{ concept.english }}</small>
                  </span>
                  <em>{{ concept.systemPosition }}</em>
                </summary>
                <div class="concept-body">
                  <div class="concept-definition">
                    <h3>它是什么</h3>
                    <p>{{ concept.definition }}</p>
                  </div>
                  <div class="concept-foundation">
                    <div>
                      <h3>它为什么存在</h3>
                      <p>{{ concept.why }}</p>
                    </div>
                    <div>
                      <h3>它解决的问题</h3>
                      <p>{{ concept.problemSolved }}</p>
                    </div>
                  </div>
                  <dl class="concept-spec">
                    <div><dt>输入</dt><dd>{{ concept.input }}</dd></div>
                    <div><dt>输出</dt><dd>{{ concept.output }}</dd></div>
                    <div><dt>系统位置</dt><dd>{{ concept.systemPosition }}</dd></div>
                    <div><dt>主要负责者</dt><dd>{{ concept.owner }}</dd></div>
                    <div><dt>不负责什么</dt><dd>{{ concept.notResponsibleFor }}</dd></div>
                    <div><dt>与相似概念的区别</dt><dd>{{ concept.compareWith }}</dd></div>
                  </dl>
                  <div class="concept-process">
                    <h3>它如何一步步工作</h3>
                    <ol>
                      <li v-for="step in concept.process" :key="step">{{ step }}</li>
                    </ol>
                  </div>
                  <div class="concept-evidence-grid">
                    <div>
                      <h3>从哪里看到证据</h3>
                      <ul><li v-for="item in concept.evidence" :key="item">{{ item }}</li></ul>
                    </div>
                    <div>
                      <h3>常见失败模式</h3>
                      <ul><li v-for="item in concept.failureModes" :key="item">{{ item }}</li></ul>
                    </div>
                  </div>
                  <div class="pm-use">
                    <h3>产品经理什么时候会用</h3>
                    <p>{{ concept.pmUse }}</p>
                  </div>
                  <div class="example-compare">
                    <div class="correct-example">
                      <h3>正确示例</h3>
                      <p>{{ concept.correctExample }}</p>
                    </div>
                    <div class="incorrect-example">
                      <h3>错误示例</h3>
                      <p>{{ concept.incorrectExample }}</p>
                    </div>
                  </div>
                  <div class="concept-study-action">
                    <p>这个确认只记录完整首学进度，不会提高掌握等级。</p>
                    <button type="button" class="secondary-button" :disabled="readonly" @click="toggleConceptStudied(concept.id)">
                      {{ evidence.visitedConceptIds.includes(concept.id) ? '撤销本概念首学确认' : '确认已完成本概念首学' }}
                    </button>
                  </div>
                </div>
              </details>
            </div>
            </details>
            <div class="section-action">
              <p v-if="sectionRequirement('concepts')">{{ sectionRequirement('concepts') }}</p>
              <button
                class="secondary-button"
                type="button"
                :disabled="readonly || !!sectionRequirement('concepts')"
                @click="toggleSectionComplete('concepts')"
              >
                {{ isSectionComplete('concepts') ? '撤销本节完成' : `确认完成 ${lesson.concepts.length} 个概念首学` }}
              </button>
            </div>
          </div>
          <div v-else class="locked-section" role="note">
            <strong>正文暂未开放</strong>
            <p>先完成第 3 节前置知识检查，避免在基础概念缺失时直接进入高阶内容。</p>
            <button type="button" class="text-button" @click="scrollToSection('prerequisites')">返回前置检查</button>
          </div>
        </section>

        <section
          :id="sectionDomId('diagram')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-diagram-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">5</span>
            <h2 :id="`${lesson.id}-diagram-title`">概念关系图</h2>
            <span class="section-state">{{ isSectionComplete('diagram') ? '已完成' : '待阅读' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <figure class="relationship-figure" tabindex="0" aria-label="概念关系图，可在窄屏中横向滚动">
              <figcaption>
                <strong>{{ lesson.diagram.title }}</strong>
                <span>{{ lesson.diagram.caption }}</span>
              </figcaption>
              <ol class="diagram-nodes">
                <li v-for="node in lesson.diagram.nodes" :key="node.id">
                  <strong>{{ node.label }}</strong>
                  <p>{{ node.description }}</p>
                  <small v-if="node.evidence">可观察证据：{{ node.evidence }}</small>
                </li>
              </ol>
              <ul v-if="lesson.diagram.branches.length" class="diagram-branches" aria-label="关系与分支">
                <li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind">
                  <span>{{ nodeLabel(branch.from) }}</span>
                  <i aria-hidden="true"></i>
                  <em>{{ branch.label }}</em>
                  <i aria-hidden="true"></i>
                  <span>{{ nodeLabel(branch.to) }}</span>
                </li>
              </ul>
              <div class="evidence-notes">
                <h3>读图时要找的证据</h3>
                <ul><li v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</li></ul>
              </div>
            </figure>
            <div class="section-action">
              <button class="secondary-button" type="button" :disabled="readonly" @click="toggleSectionComplete('diagram')">
                {{ isSectionComplete('diagram') ? '撤销本节完成' : '我能沿关系图解释输入与输出' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('demonstration')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-demonstration-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">6</span>
            <h2 :id="`${lesson.id}-demonstration-title`">从头到尾的完整示范</h2>
            <span class="section-state">{{ isSectionComplete('demonstration') ? '已完成' : '教师示范' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <div class="demo-opening">
              <h3>{{ lesson.demonstration.title }}</h3>
              <p><strong>业务问题：</strong>{{ lesson.demonstration.businessProblem }}</p>
            </div>
            <p class="section-intro">以下 {{ lesson.demonstration.steps.length }} 步是一条不可拆掉的完整证据链，可在多个专注时段中继续，但不用摘要步冒充“从头到尾”。</p>
            <ol class="demo-timeline">
              <li v-for="(step, index) in lesson.demonstration.steps" :key="`${index}-${step.title}`">
                <div class="demo-step-title"><span>{{ index + 1 }}</span><h3>{{ step.title }}</h3></div>
                <dl>
                  <div><dt>教师操作</dt><dd>{{ step.action }}</dd></div>
                  <div><dt>为什么这样做</dt><dd>{{ step.reason }}</dd></div>
                  <div><dt>看到的证据</dt><dd>{{ step.evidence }}</dd></div>
                  <div><dt>证据能证明</dt><dd>{{ step.proves }}</dd></div>
                  <div><dt>证据不能证明</dt><dd>{{ step.limitation }}</dd></div>
                </dl>
              </li>
            </ol>
            <div id="demonstration-conclusion" class="demo-conclusion" tabindex="-1">
              <p><strong>最终结论：</strong>{{ lesson.demonstration.finalConclusion }}</p>
              <p><strong>结论限制：</strong>{{ lesson.demonstration.conclusionLimit }}</p>
            </div>
            <div class="section-action">
              <button class="secondary-button" type="button" :disabled="readonly" @click="toggleSectionComplete('demonstration')">
                {{ isSectionComplete('demonstration') ? '撤销本节完成' : '我能复述示范的证据链' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('guided-lab')"
          class="lesson-section lab-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-guided-lab-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">7</span>
            <h2 :id="`${lesson.id}-guided-lab-title`">引导式实验</h2>
            <span class="section-state">{{ isSectionComplete('guided-lab') ? '已完成' : '边做边记录' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <div class="lab-brief">
              <h3>{{ lesson.guidedLab.title }}</h3>
              <p><strong>实验目标：</strong>{{ lesson.guidedLab.goal }}</p>
              <p class="safety-note"><strong>安全边界：</strong>{{ lesson.guidedLab.safety }}</p>
            </div>
            <label class="field-block">
              <span>1. 先预测</span>
              <small>{{ lesson.guidedLab.predictionPrompt }}</small>
              <textarea v-model="evidence.guidedLab.prediction" :readonly="readonly" rows="4" placeholder="在操作前写下你的判断，以及判断依据。"></textarea>
            </label>

            <div class="teaching-sandbox" aria-labelledby="sandbox-title">
              <div class="sandbox-heading">
                <div>
                  <h3 id="sandbox-title">{{ experimentLabel }}</h3>
                  <p v-if="experimentMode === 'frontend'">这是本地教学模拟。你会直接修改页面 DOM、触发按钮事件，并使用受限 Console；它不会执行任意代码。</p>
                  <p v-else-if="experimentMode === 'dns'">这是本地寻址模拟。你会拆分域名、运行受限解析命令并观察入口状态；它不会查询真实公司域名。</p>
                  <p v-else>这是本地 HTTP 模拟。你会修改请求变量、触发固定样例响应并比较字段与测量；它不会发送真实业务请求。</p>
                </div>
                <span>教学模拟</span>
              </div>
              <div class="sandbox-workspace">
                <div class="preview-pane" aria-label="教学页面预览">
                  <div class="preview-address">{{ experimentAddress }}</div>
                  <div class="preview-content">
                    <p class="preview-brand">{{ experimentMode === 'dns' ? '寻址入口示范' : experimentMode === 'http' ? 'HTTP 交换示范' : '活动报名示范' }}</p>
                    <h3
                      data-sandbox-element="headline"
                      :contenteditable="readonly ? 'false' : 'true'"
                      role="textbox"
                      aria-label="可编辑的教学页面标题"
                      aria-multiline="false"
                      spellcheck="false"
                      @input="onEditableHeadline"
                      @keydown.enter.prevent
                    >{{ evidence.sandbox.previewHeadline }}</h3>
                    <p>{{ experimentMode === 'dns' ? '输入域名或 URL，观察解析结果、TTL 和入口状态；这些现象不能替代真实服务健康证据。' : experimentMode === 'http' ? '输入请求体变量，观察 Status、Response、Timing 和 Size；这些现象不能替代真实业务持久化证据。' : '输入年龄，观察前端提示、按钮属性和页面状态；这些现象不能替代后端资格证据。' }}</p>
                    <label class="preview-age-field">
                      <span>{{ experimentInputLabel }}</span>
                      <input v-model="evidence.sandbox.ageInput" :type="experimentMode === 'frontend' ? 'number' : 'text'" :min="experimentMode === 'frontend' ? 0 : undefined" inputmode="text" :readonly="readonly" :placeholder="experimentInputPlaceholder" @input="updateSandboxAge">
                    </label>
                    <button
                      type="button"
                      :disabled="sandboxButtonDisabled"
                      :aria-busy="evidence.sandbox.buttonState === 'busy'"
                      @click="triggerSandboxButton"
                    >{{ sandboxButtonLabel }}</button>
                    <p class="preview-status" :class="evidence.sandbox.buttonState" role="status" aria-live="polite">{{ sandboxStatusText }}</p>
                    <button v-if="evidence.sandbox.ageInput || evidence.sandbox.domEdits || evidence.sandbox.buttonState !== 'idle'" type="button" class="preview-reset" :disabled="readonly" @click="resetSandboxState">清空实验预览</button>
                  </div>
                </div>
                <div class="developer-pane">
                  <div class="developer-tabs" role="tablist" aria-label="开发者工具模拟面板">
                    <button
                      id="elements-tab"
                      type="button"
                      role="tab"
                      :aria-selected="evidence.sandbox.activePanel === 'elements'"
                      aria-controls="elements-panel"
                      @click="evidence.sandbox.activePanel = 'elements'"
                    >Elements</button>
                    <button
                      id="console-tab"
                      type="button"
                      role="tab"
                      :aria-selected="evidence.sandbox.activePanel === 'console'"
                      aria-controls="console-panel"
                      @click="evidence.sandbox.activePanel = 'console'"
                    >Console</button>
                  </div>
                  <div v-if="evidence.sandbox.activePanel === 'elements'" id="elements-panel" class="elements-panel" role="tabpanel" aria-labelledby="elements-tab">
                    <pre aria-label="简化的教学观察树"><code v-if="experimentMode === 'dns'">&lt;resolver&gt;
  &lt;target&gt;{{ evidence.sandbox.previewHeadline }}&lt;/target&gt;
  &lt;input&gt;{{ evidence.sandbox.ageInput }}&lt;/input&gt;
  &lt;status&gt;{{ sandboxStatusText }}&lt;/status&gt;
&lt;/resolver&gt;</code><code v-else-if="experimentMode === 'http'">&lt;request&gt;
  &lt;target&gt;{{ evidence.sandbox.previewHeadline }}&lt;/target&gt;
  &lt;payload&gt;{{ evidence.sandbox.ageInput }}&lt;/payload&gt;
  &lt;response&gt;{{ sandboxStatusText }}&lt;/response&gt;
&lt;/request&gt;</code><code v-else>&lt;main&gt;
  &lt;h1&gt;{{ evidence.sandbox.previewHeadline }}&lt;/h1&gt;
  &lt;input type="number" value="{{ evidence.sandbox.ageInput }}" /&gt;
  &lt;p&gt;{{ sandboxStatusText }}&lt;/p&gt;
  &lt;button{{ sandboxButtonDisabled ? ' disabled' : '' }}&gt;{{ sandboxButtonLabel }}&lt;/button&gt;
&lt;/main&gt;</code></pre>
                    <label class="dev-field">
                      <span>{{ experimentMode === 'frontend' ? '编辑 h1 的 textContent' : experimentMode === 'dns' ? '编辑解析目标' : '编辑请求目标' }}</span>
                      <input v-model="evidence.sandbox.domDraft" :readonly="readonly" maxlength="80">
                    </label>
                    <button class="dev-action" type="button" :disabled="readonly || !evidence.sandbox.domDraft.trim()" @click="applyDomEdit">应用 DOM 修改</button>
                    <p>{{ evidence.sandbox.domEdits }} 次观察修改 · 也可以直接编辑左侧标题</p>
                  </div>
                  <div v-else id="console-panel" class="console-panel" role="tabpanel" aria-labelledby="console-tab">
                    <div class="console-suggestions" aria-label="安全命令示例">
                      <template v-if="experimentMode === 'dns'">
                        <button type="button" @click="runConsole(&quot;resolve('api.example.test')&quot;)">解析正常域名</button>
                        <button type="button" @click="runConsole(&quot;resolve('missing.example.test')&quot;)">模拟 NXDOMAIN</button>
                      </template>
                      <template v-else-if="experimentMode === 'http'">
                        <button type="button" @click="runConsole(&quot;request('quantity=2')&quot;)">发送正确请求</button>
                        <button type="button" @click="runConsole('request-type-error')">制造类型错误</button>
                      </template>
                      <template v-else>
                        <button type="button" @click="runConsole('1 + 1')">1 + 1</button>
                        <button type="button" @click="runConsole('17 >= 18')">17 &gt;= 18</button>
                        <button type="button" @click="runConsole(&quot;document.querySelector('h1').textContent&quot;)">读取标题</button>
                      </template>
                      <button type="button" @click="runConsole('button.click()')">触发点击</button>
                      <button type="button" @click="runConsole('state.status')">读取状态</button>
                    </div>
                    <div class="console-log" aria-live="polite">
                      <p v-if="!evidence.sandbox.consoleHistory.length" class="console-empty">输入 help 或点击一条示例命令开始。</p>
                      <div v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${index}-${entry.command}`" :class="entry.tone">
                        <code>&gt; {{ entry.command }}</code>
                        <samp>{{ entry.output }}</samp>
                      </div>
                    </div>
                    <form class="console-command" @submit.prevent="runConsole()">
                      <label for="sandbox-console-input">安全命令</label>
                      <div>
                        <span aria-hidden="true">&gt;</span>
                        <input id="sandbox-console-input" v-model="consoleInput" :readonly="readonly" autocomplete="off" spellcheck="false" placeholder="输入 help">
                        <button type="submit" :disabled="readonly || !consoleInput.trim()">运行</button>
                      </div>
                    </form>
                    <p class="sr-status" role="status" aria-live="polite">{{ consoleMessage }}</p>
                  </div>
                </div>
              </div>
            </div>

            <ol class="guided-steps">
              <li v-for="({ step, index }) in guidedStepSet" :key="`${index}-${step.title}`">
                <div class="guided-step-heading">
                  <span>{{ index + 1 }}</span>
                  <h3>{{ step.title }}</h3>
                </div>
                <dl>
                  <div><dt>操作</dt><dd>{{ step.action }}</dd></div>
                  <div><dt>观察位置</dt><dd>{{ step.observe }}</dd></div>
                  <div><dt>技术解释</dt><dd>{{ step.explanation }}</dd></div>
                  <div><dt>这能证明</dt><dd>{{ step.proves }}</dd></div>
                  <div><dt>这不能证明</dt><dd>{{ step.cannotProve }}</dd></div>
                </dl>
                <label class="field-block compact">
                  <span>记录实际观察</span>
                  <textarea v-model="evidence.guidedLab.observations[`step-${index}`]" :readonly="readonly" rows="3" placeholder="写下你实际看到的文字、状态或变化。"></textarea>
                </label>
                <label class="completion-check">
                  <input v-model="evidence.guidedLab.stepComplete[`step-${index}`]" type="checkbox" :disabled="readonly">
                  我已亲手完成这一步
                </label>
              </li>
            </ol>

            <div class="lab-records">
              <label v-for="({ prompt, index }) in guidedRecordSet" :key="prompt" class="field-block">
                <span>实验记录 {{ index + 1 }}</span>
                <small>{{ prompt }}</small>
                <textarea v-model="evidence.guidedLab.records[`record-${index}`]" :readonly="readonly" rows="3"></textarea>
              </label>
              <label class="field-block">
                <span>预测与实际对照</span>
                <small>{{ lesson.guidedLab.comparePrompt }}</small>
                <textarea v-model="evidence.guidedLab.comparison" :readonly="readonly" rows="4" placeholder="我的预测是……；实际看到……；差异说明……"></textarea>
              </label>
            </div>

            <fieldset class="criteria-list">
              <legend>通过标准</legend>
              <label v-for="(criterion, index) in lesson.guidedLab.passCriteria" :key="criterion">
                <input v-model="evidence.guidedLab.passChecks[`pass-${index}`]" type="checkbox" :disabled="readonly">
                {{ criterion }}
              </label>
            </fieldset>
            <div class="reset-row">
              <span>清空当前实验草稿会撤销本节临时完成状态，但不会删除证据账本中的历史尝试。</span>
              <button type="button" class="reset-button" :disabled="readonly" @click="resetGuidedLab">清空并重做</button>
            </div>
            <div class="section-action">
              <p v-if="sectionRequirement('guided-lab')">{{ sectionRequirement('guided-lab') }}</p>
              <button class="primary-button" type="button" :disabled="readonly || !!sectionRequirement('guided-lab')" @click="toggleSectionComplete('guided-lab')">
                {{ isSectionComplete('guided-lab') ? '撤销实验完成' : '保存引导实验证据' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('independent-lab')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-independent-lab-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">8</span>
            <h2 :id="`${lesson.id}-independent-lab-title`">独立变式实验</h2>
            <span class="section-state">{{ isSectionComplete('independent-lab') ? '已完成' : '独立完成' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <div class="independent-brief">
              <h3>{{ lesson.independentLab.title }}</h3>
              <p><strong>新场景：</strong>{{ lesson.independentLab.scenario }}</p>
              <p><strong>独立任务：</strong>{{ lesson.independentLab.task }}</p>
            </div>
            <label class="field-block independent-prediction">
              <span>1. 先独立预测</span>
              <small>{{ lesson.independentLab.predictionPrompt }}</small>
              <textarea v-model="evidence.independentLab.prediction" :readonly="readonly" rows="4" placeholder="在操作前写下初始状态、预期变化和判断依据。"></textarea>
            </label>
            <fieldset v-if="lesson.independentLab.changedConditions.length" class="condition-picker">
              <legend>选择本次改变的条件</legend>
              <label v-for="condition in lesson.independentLab.changedConditions" :key="condition">
                <input v-model="evidence.independentLab.changedCondition" type="radio" :name="`${lesson.id}-independent-condition`" :value="condition" :disabled="readonly">
                {{ condition }}
              </label>
            </fieldset>
            <div class="independent-record-grid">
              <label class="field-block">
                <span>我的操作计划</span>
                <small>不要照抄引导实验，写清你准备先做什么、再做什么。</small>
                <textarea v-model="evidence.independentLab.plan" :readonly="readonly" rows="4"></textarea>
              </label>
              <label class="field-block">
                <span>我收集的证据</span>
                <small>{{ lesson.independentLab.evidenceRequirements.join('；') }}</small>
                <textarea v-model="evidence.independentLab.evidence" :readonly="readonly" rows="4"></textarea>
              </label>
              <label class="field-block">
                <span>实际结果</span>
                <textarea v-model="evidence.independentLab.result" :readonly="readonly" rows="4"></textarea>
              </label>
              <label class="field-block">
                <span>我的结论与边界</span>
                <textarea v-model="evidence.independentLab.conclusion" :readonly="readonly" rows="4" placeholder="证据支持……；但还不能证明……"></textarea>
              </label>
            </div>
            <fieldset class="criteria-list">
              <legend>独立实验通过标准</legend>
              <label v-for="(criterion, index) in lesson.independentLab.passCriteria" :key="criterion">
                <input v-model="evidence.independentLab.passChecks[`pass-${index}`]" type="checkbox" :disabled="readonly">
                {{ criterion }}
              </label>
            </fieldset>
            <p class="remediation-note">遇到困难时，<button type="button" class="text-button" @click="revealAndScrollToAnchor(lesson.independentLab.remediation.anchor, lesson.independentLab.remediation.sectionId)">{{ lesson.independentLab.remediation.label }}</button></p>
            <div class="reset-row">
              <span>清空当前变式草稿会撤销本节临时完成状态，但不会删除证据账本中的历史尝试。</span>
              <button type="button" class="reset-button" :disabled="readonly" @click="resetIndependentLab">清空并重做</button>
            </div>
            <div class="section-action">
              <p v-if="sectionRequirement('independent-lab')">{{ sectionRequirement('independent-lab') }}</p>
              <button class="primary-button" type="button" :disabled="readonly || !!sectionRequirement('independent-lab')" @click="toggleSectionComplete('independent-lab')">
                {{ isSectionComplete('independent-lab') ? '撤销实验完成' : '保存独立实验证据' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('exercises')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-exercises-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">9</span>
            <h2 :id="`${lesson.id}-exercises-title`">针对性练习</h2>
            <span class="section-state">{{ exerciseSet.filter((item) => exerciseDraft(item.id).submitted).length }}/{{ exerciseSet.length }} 已提交</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <p class="section-intro">先在没有参考答案的情况下完成整组练习。每次提交都会锁定本次回答；全部提交后，第 10 节才开放答案、推理、错因和补学路径。</p>
            <div class="exercise-list">
              <article v-for="(exercise, index) in exerciseSet" :key="exercise.id" class="exercise-item">
                <header>
                  <span>第 {{ index + 1 }} 题 · {{ exercise.categories.join(' · ') }}</span>
                  <small>{{ exerciseKindLabel(exercise) }}</small>
                  <h3>{{ exercise.prompt }}</h3>
                </header>
                <button
                  class="hint-button"
                  type="button"
                  :aria-expanded="exerciseDraft(exercise.id).hintVisible"
                  @click="exerciseDraft(exercise.id).hintVisible = !exerciseDraft(exercise.id).hintVisible"
                >{{ exerciseDraft(exercise.id).hintVisible ? '收起作答提示' : '查看作答提示' }}</button>
                <p v-if="exerciseDraft(exercise.id).hintVisible" class="hint-text">{{ exercise.hint }}</p>

                <fieldset v-if="exercise.kind === 'single-choice' && exercise.options" class="option-list" :disabled="readonly || exerciseDraft(exercise.id).submitted">
                  <legend class="sr-only">为第 {{ index + 1 }} 题选择一个答案</legend>
                  <label v-for="(option, optionIndex) in exercise.options" :key="option.label" :class="{ selected: exerciseDraft(exercise.id).selectedIndex === optionIndex }">
                    <input v-model="exerciseDraft(exercise.id).selectedIndex" type="radio" :name="`${lesson.id}-${exercise.id}`" :value="optionIndex">
                    <span>{{ String.fromCharCode(65 + optionIndex) }}</span>
                    {{ option.label }}
                  </label>
                </fieldset>
                <label v-else class="field-block">
                  <span>你的回答</span>
                  <textarea v-model="exerciseDraft(exercise.id).response" :readonly="readonly || exerciseDraft(exercise.id).submitted" rows="5" placeholder="先写判断，再写依据和边界。"></textarea>
                </label>

                <div class="exercise-actions">
                  <button v-if="!exerciseDraft(exercise.id).submitted" class="primary-button" type="button" :disabled="readonly" @click="submitExercise(exercise)">锁定并提交本题</button>
                  <p v-else class="submitted-answer">
                    <strong>第 {{ exerciseDraft(exercise.id).attemptCount }} 次回答已锁定：</strong>
                    <span v-if="exercise.kind === 'single-choice'">{{ exercise.options?.[exerciseDraft(exercise.id).selectedIndex ?? -1]?.label || '未选择' }}</span>
                    <span v-else>{{ exerciseDraft(exercise.id).response }}</span>
                  </p>
                  <p role="status" aria-live="polite">{{ exerciseMessages[exercise.id] }}</p>
                </div>
                <div class="reset-row compact-reset-row">
                  <span>仅清空本题当前草稿和临时完成态，历史尝试保留。</span>
                  <button type="button" class="reset-button" :disabled="readonly" @click="resetExercise(exercise.id)">清空并重做</button>
                </div>
              </article>
            </div>
            <div class="section-action">
              <p v-if="sectionRequirement('exercises')">{{ sectionRequirement('exercises') }}</p>
              <button class="primary-button" type="button" :disabled="readonly || !!sectionRequirement('exercises')" @click="toggleSectionComplete('exercises')">
                {{ isSectionComplete('exercises') ? '撤销本组提交' : '确认独立作答已提交' }}
              </button>
              <button v-if="allExercisesSubmitted" class="secondary-button" type="button" @click="scrollToSection('feedback')">进入反馈与纠错</button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('feedback')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-feedback-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">10</span>
            <h2 :id="`${lesson.id}-feedback-title`">反馈与纠错</h2>
            <span class="section-state">{{ exerciseSet.filter((item) => exerciseDraft(item.id).selfAssessment === 'pass').length }}/{{ exerciseSet.length }} 已校准</span>
          </div>
          <template v-if="allPrerequisitesPassed && allExercisesSubmitted">
            <p class="section-intro">逐题对照参考答案和推理。答错或证据不完整时，必须先返回补学位置、写下修正点，再重新独立作答；提交过答案不等于完成纠错。</p>
            <div class="feedback-list">
              <article v-for="(exercise, index) in exerciseSet" :key="`feedback-${exercise.id}`" class="answer-feedback" :class="exerciseDraft(exercise.id).selfAssessment === 'pass' ? 'correct' : (exerciseNeedsCorrection(exercise) ? 'incorrect' : 'neutral')">
                <header class="feedback-header">
                  <div>
                    <span>第 {{ index + 1 }} 题 · 第 {{ exerciseDraft(exercise.id).attemptCount }} 次回答</span>
                    <h3>{{ exercise.prompt }}</h3>
                  </div>
                  <strong v-if="exercise.kind === 'single-choice'">{{ choiceIsCorrect(exercise) ? '系统判定：正确' : '系统判定：需要修正' }}</strong>
                  <strong v-else>{{ exerciseDraft(exercise.id).selfAssessment === 'pass' ? '已完成自我校准' : '等待自我校准' }}</strong>
                </header>
                <p class="submitted-response"><strong>你的回答：</strong><span v-if="exercise.kind === 'single-choice'">{{ exercise.options?.[exerciseDraft(exercise.id).selectedIndex ?? -1]?.label || '未选择' }}</span><span v-else>{{ exerciseDraft(exercise.id).response }}</span></p>
                <p><strong>参考答案：</strong>{{ exercise.referenceAnswer }}</p>
                <div>
                  <h4>解题过程</h4>
                  <ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol>
                </div>
                <div v-if="exercise.options" class="option-rationales">
                  <h4>逐项解释</h4>
                  <article v-for="(option, optionIndex) in exercise.options" :key="`${optionIndex}-${option.label}`">
                    <strong>{{ String.fromCharCode(65 + optionIndex) }}. {{ option.label }}</strong>
                    <p>{{ option.rationale }}</p>
                    <small>它可能成立的条件：{{ option.couldBeTrueWhen }}</small>
                  </article>
                </div>
                <div class="feedback-columns">
                  <div>
                    <h4>评分维度</h4>
                    <ul><li v-for="item in exercise.rubric" :key="item">{{ item }}</li></ul>
                  </div>
                  <div>
                    <h4>常见错误与原因</h4>
                    <ul><li v-for="item in exercise.commonErrors" :key="item.error"><strong>{{ item.error }}：</strong>{{ item.reason }}</li></ul>
                  </div>
                </div>
                <fieldset v-if="exercise.kind !== 'single-choice'" class="self-assessment" :disabled="readonly || Boolean(exerciseDraft(exercise.id).selfAssessment)">
                  <legend>对照参考答案后，我的回答</legend>
                  <label><input type="radio" :name="`${lesson.id}-${exercise.id}-self-assessment`" value="retry" :checked="exerciseDraft(exercise.id).selfAssessment === 'retry'" @change="setExerciseSelfAssessment(exercise, 'retry')">关键结论不成立，需要重做</label>
                  <label><input type="radio" :name="`${lesson.id}-${exercise.id}-self-assessment`" value="partial" :checked="exerciseDraft(exercise.id).selfAssessment === 'partial'" @change="setExerciseSelfAssessment(exercise, 'partial')">结论基本正确，但证据或边界不完整</label>
                  <label><input type="radio" :name="`${lesson.id}-${exercise.id}-self-assessment`" value="pass" :checked="exerciseDraft(exercise.id).selfAssessment === 'pass'" @change="setExerciseSelfAssessment(exercise, 'pass')">结论、证据和边界都完整</label>
                </fieldset>
                <div v-if="exerciseNeedsCorrection(exercise)" class="correction-workflow">
                  <h4>完成补学后再重做</h4>
                  <button type="button" class="text-button" @click="visitExerciseRemediation(exercise)">{{ exerciseDraft(exercise.id).remediationVisited ? '已打开补学位置，再次查看' : exercise.remediation.label }}</button>
                  <label class="field-block compact">
                    <span>这次需要修正什么</span>
                    <small>不少于 12 个字符，写清原答案的问题和下一次判断依据。</small>
                    <textarea v-model="exerciseDraft(exercise.id).correctionNote" :readonly="readonly" rows="3" placeholder="原答案把……误当成……；重做时我会先检查……"></textarea>
                  </label>
                  <button class="secondary-button" type="button" :disabled="readonly || !exerciseCorrectionReady(exercise)" @click="retryExercise(exercise)">完成纠错记录，重新作答</button>
                </div>
                <div v-else-if="exerciseDraft(exercise.id).selfAssessment === 'pass'" class="feedback-pass">
                  <p>本轮答案校准已通过。选择题由系统判分；开放题仍只是一份待量规或他人复核的自评证据。</p>
                  <button class="text-button" type="button" :disabled="readonly" @click="retryExercise(exercise)">自愿再练一次</button>
                </div>
                <p role="status" aria-live="polite">{{ exerciseMessages[exercise.id] }}</p>
              </article>
            </div>
            <div class="section-action">
              <p v-if="sectionRequirement('feedback')">{{ sectionRequirement('feedback') }}</p>
              <button class="primary-button" type="button" :disabled="readonly || !!sectionRequirement('feedback')" @click="toggleSectionComplete('feedback')">
                {{ isSectionComplete('feedback') ? '撤销纠错完成' : '确认反馈与纠错完成' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section">
            <strong>先完成独立作答</strong>
            <p>第 9 节当前路径的全部练习提交后，这里才显示参考答案与纠错流程。</p>
            <button type="button" class="text-button" @click="scrollToSection('exercises')">返回针对性练习</button>
          </div>
        </section>

        <section
          :id="sectionDomId('deliverable')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-deliverable-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">11</span>
            <h2 :id="`${lesson.id}-deliverable-title`">今日成果</h2>
            <span class="section-state">{{ isSectionComplete('deliverable') ? '已保存' : '需要产出' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <div class="deliverable-brief">
              <h3>{{ lesson.deliverable.title }}</h3>
              <dl>
                <div><dt>为什么做</dt><dd>{{ lesson.deliverable.purpose }}</dd></div>
                <div><dt>何时使用</dt><dd>{{ lesson.deliverable.whenToUse }}</dd></div>
                <div><dt>给谁看</dt><dd>{{ lesson.deliverable.audience }}</dd></div>
              </dl>
            </div>
            <div class="field-table-wrap" tabindex="0" aria-label="成果字段说明，可横向滚动">
              <table class="field-table">
                <thead><tr><th>字段</th><th>它回答什么</th><th>信息从哪里来</th></tr></thead>
                <tbody><tr v-for="field in lesson.deliverable.fields" :key="field.name"><th scope="row">{{ field.name }}</th><td>{{ field.meaning }}</td><td>{{ field.source }}</td></tr></tbody>
              </table>
            </div>
            <details class="example-review">
              <summary>先看一份错误示例如何被修正</summary>
              <div>
                <h3>错误示例</h3>
                <pre>{{ lesson.deliverable.badExample }}</pre>
                <ul><li v-for="reason in lesson.deliverable.badReasons" :key="reason">{{ reason }}</li></ul>
                <h3>修订步骤</h3>
                <ol><li v-for="step in lesson.deliverable.revisionSteps" :key="step">{{ step }}</li></ol>
                <h3>合格示例</h3>
                <pre>{{ lesson.deliverable.goodExample }}</pre>
              </div>
            </details>
            <div class="guided-prompts">
              <h3>动笔前先回答</h3>
              <ol><li v-for="prompt in deliverablePromptSet" :key="prompt">{{ prompt }}</li></ol>
            </div>
            <div class="template-switch" role="group" aria-label="选择成果编辑模板">
              <span>编辑方式</span>
              <button class="secondary-button" type="button" :aria-pressed="evidence.deliverable.templateKind === 'guided'" :disabled="readonly" @click="switchDeliverableTemplate('guided')">引导模板</button>
              <button class="secondary-button" type="button" :aria-pressed="evidence.deliverable.templateKind === 'blank'" :disabled="readonly" @click="switchDeliverableTemplate('blank')">空白独立练习版</button>
              <small>切换会覆盖草稿；已有填写内容时会先请求确认。</small>
            </div>
            <label class="field-block deliverable-editor">
              <span>编辑你的成果</span>
              <small>模板只是起点。请替换占位内容，写成今天真正获得的证据。</small>
              <textarea v-model="evidence.deliverable.draft" :readonly="readonly" rows="16" @input="markDeliverableTouched"></textarea>
              <small class="deliverable-count" aria-live="polite">模板文字不计入：已写入 {{ deliverableContributionCharacters }} / {{ activePath.deliverableMinimumContributionCharacters }} 个有效字符。</small>
            </label>
            <fieldset class="criteria-list">
              <legend>提交前检查</legend>
              <label v-for="({ item, index }) in deliverableChecklistSet" :key="item"><input v-model="evidence.deliverable.checklist[`item-${index}`]" type="checkbox" :disabled="readonly">{{ item }}</label>
            </fieldset>
            <div class="artifact-actions">
              <button class="primary-button" type="button" :disabled="readonly" @click="saveDeliverable">保存成果</button>
              <button class="secondary-button" type="button" @click="copyDeliverable">复制文本</button>
              <button class="secondary-button" type="button" @click="downloadDeliverable">下载成果</button>
            </div>
            <p class="artifact-message" role="status" aria-live="polite">{{ artifactMessage }}</p>
            <div class="reset-row">
              <span>恢复初始引导模板并撤销本节临时完成态；已进入证据账本的提交和审核不会删除。</span>
              <button type="button" class="reset-button" :disabled="readonly" @click="resetDeliverable">清空并重做</button>
            </div>
            <div class="section-action">
              <p v-if="sectionRequirement('deliverable')">{{ sectionRequirement('deliverable') }}</p>
              <button class="secondary-button" type="button" :disabled="readonly || !!sectionRequirement('deliverable')" @click="toggleSectionComplete('deliverable')">
                {{ isSectionComplete('deliverable') ? '撤销成果完成' : '确认成果达到今日标准' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('memory')"
          class="lesson-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-memory-title`"
        >
          <div class="section-heading">
            <span aria-hidden="true">12</span>
            <h2 :id="`${lesson.id}-memory-title`">记忆与复习</h2>
            <span class="section-state">{{ isSectionComplete('memory') ? '已安排' : '闭卷回忆' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <fieldset class="memory-anchors">
              <legend>今天真正需要记住的内容</legend>
              <label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor">
                <input v-model="evidence.memory.anchorChecks[`anchor-${index}`]" type="checkbox" :disabled="readonly">
                {{ anchor }}
              </label>
            </fieldset>
            <div class="memory-prompts">
              <label class="field-block">
                <span>闭卷解释</span>
                <small>{{ lesson.memory.closedBookPrompt }}</small>
                <textarea v-model="evidence.memory.closedBook" :readonly="readonly" rows="4" placeholder="先不回看正文，用自己的话回答。"></textarea>
              </label>
              <label class="field-block">
                <span>微操作</span>
                <small>{{ lesson.memory.microOperation }}</small>
                <textarea v-model="evidence.memory.microOperation" :readonly="readonly" rows="3" placeholder="记录你完成了什么，以及看到了什么。"></textarea>
              </label>
              <label class="field-block">
                <span>仍未解决的问题</span>
                <small>{{ lesson.memory.unresolvedPrompt }}</small>
                <textarea v-model="evidence.memory.unresolved" :readonly="readonly" rows="3" placeholder="至少写一个仍然模糊的问题；没有问题时，写一个边界问题。"></textarea>
              </label>
            </div>
            <div class="review-schedule">
              <h3>间隔复习计划</h3>
              <ol>
                <li v-for="stage in lesson.memory.reviewStages" :key="stage.stage">
                  <label>
                    <input v-model="evidence.memory.reviewChecks[stage.stage]" type="checkbox" :disabled="readonly">
                    <strong>{{ stage.stage }}</strong>
                    <span>{{ stage.task }}</span>
                  </label>
                </li>
              </ol>
            </div>
            <div class="reset-row">
              <span>清空闭卷复述、微操作和复习勾选，并撤销本节临时完成态；历史尝试保留。</span>
              <button type="button" class="reset-button" :disabled="readonly" @click="resetMemory">清空并重做</button>
            </div>
            <div class="section-action">
              <p v-if="sectionRequirement('memory')">{{ sectionRequirement('memory') }}</p>
              <button class="primary-button" type="button" :disabled="readonly || !!sectionRequirement('memory')" @click="toggleSectionComplete('memory')">
                {{ isSectionComplete('memory') ? '撤销复习安排' : '保存回忆与复习计划' }}
              </button>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>

        <section
          :id="sectionDomId('completion')"
          class="lesson-section completion-section"
          tabindex="-1"
          :aria-labelledby="`${lesson.id}-completion-title`"
        >
          <div class="section-heading completion-heading">
            <h2 :id="`${lesson.id}-completion-title`">完成本课</h2>
            <span class="section-state">{{ isSectionComplete('completion') ? '本课完成' : '最终核验' }}</span>
          </div>
          <template v-if="allPrerequisitesPassed">
            <div class="completion-summary">
              <p><strong>{{ completedLearningSections.length }}/{{ learningSectionIds.length }}</strong> 个学习段落已经留下证据。</p>
              <div v-if="incompleteSections.length">
                <h3>还需要完成</h3>
                <ul>
                  <li v-for="section in incompleteSections" :key="section.id">
                    <button type="button" class="text-button" @click="scrollToSection(section.id)">{{ section.label }}</button>
                    <span>{{ sectionRequirement(section.id) || '请在该节点击完成。' }}</span>
                  </li>
                </ul>
              </div>
              <div v-else class="ready-to-finish">
                <h3>标准学习闭环已完整</h3>
                <p>你已经完成 {{ lesson.concepts.length }} 个概念首学、完整示范、两次实验、逐题反馈、成果和复习安排。完整概念卡可继续用于复习与查阅；“本课完成”也不等于“已经掌握”。</p>
              </div>
            </div>
            <div class="section-action finish-action">
              <p v-if="sectionRequirement('completion')">{{ sectionRequirement('completion') }}</p>
              <button class="primary-button" type="button" :disabled="readonly || !canCompleteLesson" @click="toggleSectionComplete('completion')">
                {{ isSectionComplete('completion') ? '撤销本课完成' : '确认完成本课' }}
              </button>
            </div>
            <div v-if="isSectionComplete('completion') && lesson.nextLesson" class="next-lesson">
              <div>
                <h3>下一课：{{ lesson.nextLesson.title }}</h3>
                <p>{{ lesson.nextLesson.bridge }}</p>
              </div>
              <button class="secondary-button" type="button" @click="requestNextLesson">进入 {{ lesson.nextLesson.id }}</button>
            </div>
            <div v-else-if="isSectionComplete('completion')" class="next-lesson">
              <div>
                <h3>12 周核心课程已完成</h3>
                <p>请进入作品集答辩、综合复盘和后续进阶路线；核心课程不会伪造不存在的 W13D1。</p>
              </div>
            </div>
          </template>
          <div v-else class="locked-section"><p>完成前置检查后开放。</p></div>
        </section>
      </div>

      <aside class="toc-column">
        <nav class="toc-panel" aria-label="本课目录">
          <div class="toc-heading">
            <strong>本课目录</strong>
            <span>{{ completedCount }}/{{ sectionOrder.length }}</span>
          </div>
          <div class="route-progress" aria-label="本课独立学习状态">
            <span
              v-for="item in routeProgress"
              :key="item.key"
              :class="{ done: item.completed === item.total }"
              :aria-label="`${item.label}：已完成 ${item.completed}，共 ${item.total}`"
            >{{ item.label }} {{ item.completed }}/{{ item.total }}</span>
          </div>
          <ol>
            <li v-for="(section, index) in sectionOrder" :key="section.id">
              <button
                type="button"
                :class="{ complete: isSectionComplete(section.id), current: activeSectionId === section.id }"
                :aria-current="activeSectionId === section.id ? 'location' : undefined"
                :aria-label="`${section.label}，${sectionKind(section.id)}：${sectionStatusText(section.id)}`"
                :disabled="!isSectionAccessible(section.id)"
                @click="scrollToSection(section.id)"
              >
                <span>{{ section.id === 'completion' ? '核' : index + 1 }}</span>
                <em>{{ section.label }}</em>
                <small>{{ sectionStatusText(section.id) }}</small>
              </button>
            </li>
          </ol>
          <p v-if="evidence.savedAt" class="last-saved">最近保存：{{ new Date(evidence.savedAt).toLocaleString('zh-CN', { hour12: false }) }}</p>
        </nav>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.daily-lesson {
  --lesson-paper: #e8edef;
  --lesson-paper-deep: #dce4e7;
  --lesson-surface: #fbfcfc;
  --lesson-white: #fff;
  --lesson-ink: #132d3c;
  --lesson-ink-soft: #4b626d;
  --lesson-ink-faint: #5d717b;
  --lesson-navy: #062f43;
  --lesson-navy-deep: #05283a;
  --lesson-orange: #e2672d;
  --lesson-orange-deep: #a94419;
  --lesson-orange-pale: #fbe8dd;
  --lesson-red: #c83f36;
  --lesson-red-pale: #f9e6e3;
  --lesson-green: #277b61;
  --lesson-green-pale: #e0f1eb;
  --lesson-blue-pale: #dfeaf0;
  --lesson-line: #b9c6cc;
  --lesson-line-strong: #8498a2;
  --lesson-display: "Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif;
  --lesson-body: "Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif;
  --lesson-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  width: min(1240px, 100%);
  margin: 0 auto;
  color: var(--lesson-ink);
  font-family: var(--lesson-body);
  font-size: 16px;
  line-height: 1.7;
}

.daily-lesson,
.daily-lesson * {
  box-sizing: border-box;
}

.daily-lesson button,
.daily-lesson input,
.daily-lesson textarea {
  font: inherit;
}

.daily-lesson button:not(:disabled),
.daily-lesson summary,
.daily-lesson input[type="checkbox"]:not(:disabled),
.daily-lesson input[type="radio"]:not(:disabled) {
  cursor: pointer;
}

.daily-lesson button:focus-visible,
.daily-lesson input:focus-visible,
.daily-lesson textarea:focus-visible,
.daily-lesson summary:focus-visible,
.daily-lesson [contenteditable="true"]:focus-visible,
.daily-lesson [tabindex="0"]:focus-visible {
  outline: 3px solid rgba(230, 106, 44, .4);
  outline-offset: 3px;
}

.daily-lesson h1,
.daily-lesson h2,
.daily-lesson h3,
.daily-lesson h4,
.daily-lesson h5,
.daily-lesson p,
.daily-lesson blockquote,
.daily-lesson dl,
.daily-lesson dd,
.daily-lesson ol,
.daily-lesson ul,
.daily-lesson figure,
.daily-lesson fieldset,
.daily-lesson pre {
  margin-top: 0;
}

.daily-lesson h1,
.daily-lesson h2,
.daily-lesson h3,
.daily-lesson strong {
  text-wrap: balance;
}

.daily-lesson p,
.daily-lesson li,
.daily-lesson dd,
.daily-lesson small,
.daily-lesson span,
.daily-lesson button,
.daily-lesson textarea,
.daily-lesson input {
  overflow-wrap: anywhere;
}

.lesson-cover {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
  gap: 26px 42px;
  padding: 38px 42px 32px;
  color: #f6fafb;
  background: var(--lesson-navy);
  border-radius: 14px;
  box-shadow: 0 14px 36px rgba(23, 52, 69, .11);
  overflow: hidden;
}

.lesson-title-block {
  min-width: 0;
}

.lesson-title-block h1 {
  max-width: 18ch;
  margin-bottom: 12px;
  font-family: var(--lesson-display);
  font-size: clamp(36px, 4.3vw, 58px);
  font-weight: 820;
  letter-spacing: -.025em;
  line-height: 1.14;
}

.lesson-subtitle {
  max-width: 58ch;
  margin-bottom: 18px;
  color: #d5e3e8;
  font-size: 18px;
  line-height: 1.65;
}

.lesson-code {
  margin-bottom: 0;
  color: #ffb38e;
  font-family: var(--lesson-mono);
  font-size: 12px;
  letter-spacing: .03em;
}

.lesson-facts {
  align-self: start;
  display: grid;
  gap: 0;
  margin-bottom: 0;
  border-top: 1px solid rgba(231, 241, 244, .25);
}

.lesson-facts div {
  display: grid;
  grid-template-columns: 88px 1fr;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(231, 241, 244, .18);
}

.lesson-facts dt {
  color: #a9c0ca;
  font-size: 13px;
  font-weight: 700;
}

.lesson-facts dd {
  margin: 0;
  color: #fff;
  font-size: 14px;
  line-height: 1.55;
}

.cover-progress {
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
}

.cover-progress div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #e9f1f4;
  font-size: 13px;
}

.cover-progress progress {
  width: 100%;
  height: 7px;
  border: 0;
  border-radius: 0;
  color: var(--lesson-orange);
  background: rgba(255, 255, 255, .14);
  appearance: none;
}

.cover-progress progress::-webkit-progress-bar {
  background: rgba(255, 255, 255, .14);
}

.cover-progress progress::-webkit-progress-value {
  background: var(--lesson-orange);
}

.cover-progress progress::-moz-progress-bar {
  background: var(--lesson-orange);
}

.lesson-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 244px;
  align-items: stretch;
  gap: 0;
  margin-top: 28px;
  background: var(--lesson-navy-deep);
  border-radius: 14px;
  box-shadow: 0 14px 36px rgba(23, 52, 69, .11);
}

.lesson-manuscript {
  min-width: 0;
  background: var(--lesson-white);
  border-radius: 14px 0 0 14px;
  overflow: hidden;
}

.lesson-section {
  min-width: 0;
  padding: 46px clamp(28px, 4.2vw, 52px) 50px;
  border-bottom: 1px solid var(--lesson-line);
  scroll-margin-top: 22px;
}

.lesson-section:last-child {
  border-bottom: 0;
}

.lesson-section:focus {
  outline: 0;
}

.lesson-section:focus-visible {
  outline: 3px solid rgba(230, 106, 44, .4);
  outline-offset: -3px;
}

.section-heading {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  margin-bottom: 24px;
}

.section-heading > span:first-child {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  color: #fff;
  background: var(--lesson-navy);
  border-radius: 50%;
  font-family: var(--lesson-mono);
  font-size: 13px;
  line-height: 1;
}

.section-heading h2 {
  margin-bottom: 0;
  font-family: var(--lesson-display);
  font-size: clamp(25px, 3vw, 32px);
  font-weight: 800;
  letter-spacing: -.018em;
  line-height: 1.3;
}

.completion-heading {
  grid-template-columns: minmax(0, 1fr) auto;
}

.section-state {
  padding: 5px 8px;
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.section-intro {
  max-width: 68ch;
  margin-bottom: 24px;
  color: var(--lesson-ink-soft);
  font-size: 17px;
}

.scenario-section {
  padding-top: 40px;
}

.scenario-brief {
  max-width: 70ch;
  padding: 24px 26px;
  background: var(--lesson-blue-pale);
  border-radius: 12px;
}

.scenario-brief p {
  margin-bottom: 11px;
}

.scenario-brief p:last-child {
  margin-bottom: 0;
}

.scenario-brief blockquote {
  margin: 20px 0;
  padding: 14px 16px;
  color: var(--lesson-navy);
  background: var(--lesson-white);
  border: 1px solid var(--lesson-line-strong);
  border-radius: 8px;
  font-size: 20px;
  font-weight: 760;
  line-height: 1.55;
}

.objective-list {
  max-width: 72ch;
  margin-bottom: 0;
  padding-left: 0;
  list-style: none;
  counter-reset: objective;
  border-top: 1px solid var(--lesson-line);
}

.objective-list li {
  counter-increment: objective;
  display: grid;
  grid-template-columns: 34px 1fr;
  gap: 5px 13px;
  padding: 17px 0;
  border-bottom: 1px solid var(--lesson-line);
}

.objective-list li::before {
  content: counter(objective, decimal-leading-zero);
  grid-row: 1 / 3;
  color: var(--lesson-orange-deep);
  font-family: var(--lesson-mono);
  font-size: 12px;
  font-weight: 700;
}

.objective-list strong {
  font-size: 17px;
}

.objective-list span {
  color: var(--lesson-ink-soft);
  font-size: 14px;
}

.prerequisite-list {
  display: grid;
  gap: 18px;
}

.prerequisite-list fieldset {
  margin-bottom: 0;
  padding: 20px;
  background: var(--lesson-surface);
  border: 1px solid var(--lesson-line);
  border-radius: 10px;
}

.prerequisite-list legend {
  padding: 0 7px;
  font-size: 17px;
  font-weight: 760;
}

.prerequisite-list p {
  margin-bottom: 15px;
  color: var(--lesson-ink-soft);
}

.prerequisite-remediation {
  margin-top: 12px;
  padding: 0 14px;
  background: var(--lesson-paper);
  border: 1px solid var(--lesson-line);
  border-radius: 10px;
}

.prerequisite-remediation summary {
  min-height: 44px;
  padding: 11px 0;
  color: var(--lesson-navy);
  font-weight: 760;
  cursor: pointer;
}

.prerequisite-remediation[open] {
  padding-bottom: 13px;
}

.prerequisite-remediation ol {
  margin: 8px 0 12px;
  padding-left: 22px;
}

.prerequisite-remediation li + li {
  margin-top: 7px;
}

.deliverable-count {
  display: block;
  margin-top: 7px;
  color: var(--lesson-ink-soft);
  font-variant-numeric: tabular-nums;
}

.concept-study-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--lesson-line);
}

.concept-study-action p {
  margin: 0;
  color: var(--lesson-ink-soft);
  font-size: 13px;
}

.concept-study-action button {
  flex: 0 0 auto;
}

.decision-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.decision-row label,
.option-list label {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 9px 12px;
  background: var(--lesson-white);
  border: 1px solid var(--lesson-line);
  border-radius: 8px;
}

.decision-row label.selected,
.option-list label.selected {
  color: var(--lesson-navy);
  background: var(--lesson-orange-pale);
  border-color: var(--lesson-orange);
}

.daily-lesson input[type="checkbox"],
.daily-lesson input[type="radio"] {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: var(--lesson-orange-deep);
}

.empty-note,
.readiness-message,
.remediation-note {
  padding: 14px 16px;
  border-radius: 8px;
}

.empty-note {
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
}

.readiness-message {
  margin-top: 18px;
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
}

.readiness-message.ready {
  color: #185b47;
  background: var(--lesson-green-pale);
}

.readiness-message.warning {
  color: #8e2c26;
  background: var(--lesson-red-pale);
}

.locked-section {
  padding: 22px;
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
  border-radius: 10px;
  text-align: center;
}

.locked-section strong {
  color: var(--lesson-ink);
  font-size: 18px;
}

.locked-section p {
  max-width: 58ch;
  margin: 7px auto 10px;
}

.concept-list {
  border-top: 1px solid var(--lesson-line-strong);
}

.concept-list > details {
  border-bottom: 1px solid var(--lesson-line-strong);
}

.concept-list > details > summary {
  display: grid;
  grid-template-columns: minmax(170px, .55fr) minmax(0, 1fr);
  gap: 20px;
  padding: 20px 6px;
  list-style: none;
}

.concept-list > details > summary::-webkit-details-marker {
  display: none;
}

.concept-list > details > summary::after {
  content: "+";
  position: absolute;
  right: 0;
  color: var(--lesson-orange-deep);
  font-size: 23px;
  line-height: 1;
}

.concept-list > details > summary {
  position: relative;
  padding-right: 34px;
}

.concept-list > details[open] > summary::after {
  content: "−";
}

.concept-list summary > span {
  display: grid;
  align-content: start;
}

.concept-list summary strong {
  color: var(--lesson-navy);
  font-size: 20px;
}

.concept-list summary small {
  color: var(--lesson-ink-faint);
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.concept-list summary em {
  color: var(--lesson-ink-soft);
  font-style: normal;
}

.concept-body {
  padding: 26px;
  background: var(--lesson-paper);
  border-radius: 10px;
  margin-bottom: 20px;
}

.concept-body h3 {
  margin-bottom: 7px;
  font-size: 15px;
  font-weight: 780;
}

.concept-body p {
  margin-bottom: 0;
}

.core-concept-groups {
  display: grid;
  gap: 14px;
  margin-bottom: 22px;
}

.core-concept-groups article {
  padding: 20px 22px;
  background: var(--lesson-blue-pale);
  border-radius: 10px;
}

.core-concept-groups h3 {
  margin-bottom: 8px;
  font-size: 20px;
}

.core-concept-groups p {
  margin-bottom: 10px;
}

.core-concept-groups small {
  display: block;
  color: var(--lesson-ink-soft);
  font-size: 14px;
  line-height: 1.65;
}

.extension-reading {
  margin-top: 22px;
  padding: 0 18px 18px;
  background: var(--lesson-surface);
  border: 1px solid var(--lesson-line);
  border-radius: 10px;
}

.extension-reading > summary {
  padding: 16px 0;
  color: var(--lesson-navy);
  font-weight: 760;
}

.extension-reading > p {
  color: var(--lesson-ink-soft);
}

.extension-timeline {
  margin-top: 22px;
}

.concept-definition {
  margin-bottom: 18px;
  padding: 17px;
  background: var(--lesson-white);
  border-radius: 8px;
}

.concept-foundation,
.concept-evidence-grid,
.example-compare,
.feedback-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.concept-foundation > div,
.concept-evidence-grid > div,
.example-compare > div {
  padding: 17px;
  background: var(--lesson-white);
  border-radius: 8px;
}

.concept-spec {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 20px 0;
  border-top: 1px solid var(--lesson-line);
  border-left: 1px solid var(--lesson-line);
}

.concept-spec div {
  padding: 13px 14px;
  background: rgba(255, 255, 255, .55);
  border-right: 1px solid var(--lesson-line);
  border-bottom: 1px solid var(--lesson-line);
}

.concept-spec dt {
  margin-bottom: 3px;
  color: var(--lesson-ink-faint);
  font-size: 12px;
  font-weight: 700;
}

.concept-spec dd {
  margin: 0;
  font-size: 15px;
}

.concept-process {
  margin-bottom: 20px;
  padding: 18px 20px;
  color: #edf5f7;
  background: var(--lesson-navy);
  border-radius: 10px;
}

.concept-process h3 {
  color: #fff;
}

.concept-process ol {
  margin-bottom: 0;
  padding-left: 23px;
}

.concept-evidence-grid ul,
.feedback-columns ul {
  margin-bottom: 0;
  padding-left: 20px;
}

.concept-evidence-grid li,
.feedback-columns li {
  margin-bottom: 6px;
}

.pm-use {
  margin: 20px 0;
  padding: 17px 18px;
  color: #174f3e;
  background: var(--lesson-green-pale);
  border-radius: 8px;
}

.incorrect-example {
  color: #752924;
  background: var(--lesson-red-pale) !important;
}

.correct-example {
  color: #174f3e;
  background: var(--lesson-green-pale) !important;
}

.relationship-figure {
  margin-bottom: 0;
  overflow-x: auto;
  scrollbar-gutter: stable;
}

.relationship-figure figcaption {
  display: grid;
  gap: 5px;
  margin-bottom: 20px;
}

.relationship-figure figcaption strong {
  font-size: 20px;
}

.relationship-figure figcaption span {
  color: var(--lesson-ink-soft);
}

.diagram-nodes {
  display: grid;
  grid-auto-columns: minmax(190px, 1fr);
  grid-auto-flow: column;
  margin-bottom: 18px;
  padding: 0;
  border: 1px solid var(--lesson-line-strong);
  border-radius: 10px;
  list-style: none;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
}

.diagram-nodes li {
  min-width: 0;
  padding: 18px;
  background: var(--lesson-surface);
  border-right: 1px solid var(--lesson-line-strong);
}

.diagram-nodes li:last-child {
  border-right: 0;
}

.diagram-nodes strong {
  color: var(--lesson-navy);
  font-size: 17px;
}

.diagram-nodes p {
  margin: 5px 0 9px;
  font-size: 14px;
}

.diagram-nodes small {
  display: block;
  color: var(--lesson-ink-faint);
  font-size: 12px;
}

.diagram-branches {
  display: grid;
  gap: 8px;
  margin-bottom: 22px;
  padding: 0;
  list-style: none;
}

.diagram-branches li {
  display: grid;
  grid-template-columns: minmax(110px, 1fr) minmax(20px, .4fr) auto minmax(20px, .4fr) minmax(110px, 1fr);
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  color: var(--lesson-navy);
  background: var(--lesson-blue-pale);
  border-radius: 7px;
  font-size: 13px;
  text-align: center;
}

.diagram-branches li.failure {
  color: #7b2d27;
  background: var(--lesson-red-pale);
}

.diagram-branches i {
  height: 1px;
  background: currentColor;
}

.diagram-branches em {
  font-style: normal;
  font-weight: 700;
}

.evidence-notes {
  padding: 18px 20px;
  color: #eaf2f5;
  background: var(--lesson-navy-deep);
  border-radius: 10px;
}

.evidence-notes h3 {
  margin-bottom: 7px;
  color: #fff;
  font-size: 16px;
}

.evidence-notes ul {
  margin-bottom: 0;
  padding-left: 20px;
}

.demo-opening,
.demo-conclusion,
.lab-brief,
.independent-brief,
.deliverable-brief {
  padding: 20px 22px;
  background: var(--lesson-blue-pale);
  border-radius: 10px;
}

.demo-opening h3,
.lab-brief h3,
.independent-brief h3,
.deliverable-brief h3 {
  margin-bottom: 7px;
  font-size: 21px;
}

.demo-opening p,
.demo-conclusion p,
.lab-brief p,
.independent-brief p {
  margin-bottom: 8px;
}

.demo-opening p:last-child,
.demo-conclusion p:last-child,
.lab-brief p:last-child,
.independent-brief p:last-child {
  margin-bottom: 0;
}

.demo-timeline,
.guided-steps {
  position: relative;
  margin: 26px 0;
  padding: 0;
  list-style: none;
}

.demo-timeline::before,
.guided-steps::before {
  content: "";
  position: absolute;
  top: 18px;
  bottom: 18px;
  left: 17px;
  width: 1px;
  background: var(--lesson-line-strong);
}

.demo-timeline > li,
.guided-steps > li {
  position: relative;
  padding: 0 0 28px 54px;
}

.demo-timeline > li:last-child,
.guided-steps > li:last-child {
  padding-bottom: 0;
}

.demo-step-title,
.guided-step-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.demo-step-title span,
.guided-step-heading span {
  position: absolute;
  left: 0;
  display: grid;
  place-items: center;
  width: 35px;
  height: 35px;
  color: #fff;
  background: var(--lesson-orange-deep);
  border-radius: 50%;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.demo-step-title h3,
.guided-step-heading h3 {
  margin-bottom: 0;
  font-size: 19px;
}

.demo-timeline dl,
.guided-steps dl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 0;
  border-top: 1px solid var(--lesson-line);
  border-left: 1px solid var(--lesson-line);
}

.demo-timeline dl div,
.guided-steps dl div {
  padding: 13px 14px;
  border-right: 1px solid var(--lesson-line);
  border-bottom: 1px solid var(--lesson-line);
}

.demo-timeline dt,
.guided-steps dt {
  margin-bottom: 3px;
  color: var(--lesson-ink-faint);
  font-size: 12px;
  font-weight: 700;
}

.demo-timeline dd,
.guided-steps dd {
  margin: 0;
  font-size: 15px;
}

.demo-conclusion {
  color: #174f3e;
  background: var(--lesson-green-pale);
}

.field-block {
  display: grid;
  gap: 6px;
  margin-top: 22px;
}

.field-block > span {
  font-weight: 760;
}

.field-block > small {
  color: var(--lesson-ink-soft);
  font-size: 14px;
}

.field-block textarea,
.dev-field input,
.console-command input {
  width: 100%;
  min-width: 0;
  padding: 11px 12px;
  color: var(--lesson-ink);
  background: var(--lesson-white);
  border: 1px solid var(--lesson-line-strong);
  border-radius: 8px;
  resize: vertical;
}

.field-block textarea[readonly],
.dev-field input[readonly],
.console-command input[readonly] {
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
}

.field-block.compact {
  margin-top: 14px;
}

.safety-note {
  color: #7e2f28;
}

.teaching-sandbox {
  margin-top: 26px;
  color: #eaf2f5;
  background: var(--lesson-navy-deep);
  border-radius: 11px;
  box-shadow: 0 8px 22px rgba(23, 52, 69, .16);
  overflow: hidden;
}

.sandbox-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 20px;
  border-bottom: 1px solid rgba(215, 233, 239, .18);
}

.sandbox-heading h3 {
  margin-bottom: 4px;
  color: #fff;
  font-size: 20px;
}

.sandbox-heading p {
  max-width: 68ch;
  margin-bottom: 0;
  color: #bcd0d8;
  font-size: 14px;
}

.sandbox-heading > span {
  flex: 0 0 auto;
  padding: 5px 8px;
  color: #bfe7d8;
  background: rgba(39, 123, 97, .24);
  border-radius: 4px;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.sandbox-workspace {
  display: grid;
  grid-template-columns: minmax(260px, .85fr) minmax(320px, 1.15fr);
  min-height: 430px;
}

.preview-pane {
  padding: 14px;
  color: var(--lesson-ink);
  background: #dce3e6;
}

.preview-address {
  padding: 7px 10px;
  color: var(--lesson-ink-faint);
  background: #fff;
  border-radius: 7px 7px 0 0;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.preview-content {
  min-height: 360px;
  padding: 32px 25px;
  background: #fff;
  border-radius: 0 0 7px 7px;
}

.preview-brand {
  margin-bottom: 43px;
  color: var(--lesson-ink-faint);
  font-size: 13px;
  font-weight: 700;
}

.preview-content h3 {
  margin-bottom: 12px;
  font-size: 28px;
  line-height: 1.25;
}

.preview-content h3[contenteditable="true"] {
  min-height: 1.4em;
  border-bottom: 1px dashed var(--lesson-line-strong);
}

.preview-content > p:not(.preview-brand, .preview-status) {
  color: var(--lesson-ink-soft);
  font-size: 14px;
}

.preview-age-field {
  display: grid;
  gap: 6px;
  max-width: 220px;
  margin: 18px 0 14px;
}

.preview-age-field span {
  color: var(--lesson-ink-soft);
  font-size: 12px;
  font-weight: 700;
}

.preview-age-field input {
  min-height: 44px;
  padding: 0 12px;
  color: var(--lesson-ink);
  background: #fff;
  border: 1px solid var(--lesson-line-strong);
  border-radius: 7px;
}

.preview-content > button:first-of-type {
  min-height: 42px;
  padding: 0 17px;
  color: #fff;
  background: var(--lesson-orange);
  border: 0;
  border-radius: 9px;
  font-weight: 700;
}

.preview-content > button:first-of-type:hover:not(:disabled) {
  background: var(--lesson-orange-deep);
}

.preview-content > button:first-of-type:disabled {
  color: #6f7b81;
  background: #d5dde0;
  cursor: not-allowed;
}

.preview-status {
  margin: 15px 0 0;
  padding: 9px 10px;
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
  border-radius: 7px;
  font-size: 13px;
}

.preview-status.busy {
  color: #79441e;
  background: var(--lesson-orange-pale);
}

.preview-status.success {
  color: #175642;
  background: var(--lesson-green-pale);
}

.preview-reset {
  margin-top: 9px;
  padding: 4px 0;
  color: var(--lesson-navy);
  background: transparent;
  border: 0;
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.developer-pane {
  min-width: 0;
  border-left: 1px solid rgba(215, 233, 239, .16);
}

.developer-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid rgba(215, 233, 239, .18);
}

.developer-tabs button {
  min-height: 43px;
  padding: 0 16px;
  color: #9fb7c1;
  background: transparent;
  border: 0;
  border-bottom: 3px solid transparent;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.developer-tabs button[aria-selected="true"] {
  color: #fff;
  border-bottom-color: var(--lesson-orange);
}

.elements-panel,
.console-panel {
  min-width: 0;
  padding: 16px;
}

.elements-panel pre {
  max-width: 100%;
  margin-bottom: 16px;
  padding: 14px;
  color: #d9e9ee;
  background: #061f2e;
  border-radius: 8px;
  font-family: var(--lesson-mono);
  font-size: 12px;
  line-height: 1.65;
  overflow: auto;
}

.dev-field {
  display: grid;
  gap: 5px;
}

.dev-field span {
  color: #c8d9df;
  font-size: 13px;
}

.dev-field input {
  color: #eff6f8;
  background: #123b54;
  border-color: #607f8e;
}

.dev-action,
.console-command button {
  min-height: 38px;
  margin-top: 9px;
  padding: 0 13px;
  color: #fff;
  background: var(--lesson-orange);
  border: 0;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
}

.elements-panel > p {
  margin: 11px 0 0;
  color: #9eb6c0;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.console-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 12px;
}

.console-suggestions button {
  padding: 6px 8px;
  color: #c7d9df;
  background: #123b54;
  border: 1px solid #426779;
  border-radius: 5px;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.console-log {
  height: 220px;
  padding: 12px;
  color: #dbe9ee;
  background: #061f2e;
  border-radius: 8px;
  font-family: var(--lesson-mono);
  font-size: 12px;
  overflow: auto;
}

.console-log > div {
  display: grid;
  gap: 2px;
  padding: 7px 0;
  border-bottom: 1px solid rgba(215, 233, 239, .1);
}

.console-log code,
.console-log samp {
  white-space: pre-wrap;
}

.console-log .success samp {
  color: #7dd8b5;
}

.console-log .error samp {
  color: #ff928b;
}

.console-empty {
  color: #8da8b3;
}

.console-command {
  margin-top: 12px;
}

.console-command > label {
  display: block;
  margin-bottom: 5px;
  color: #c5d7dd;
  font-size: 13px;
}

.console-command > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
}

.console-command input {
  color: #edf5f7;
  background: #123b54;
  border-color: #607f8e;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.console-command button {
  margin-top: 0;
}

.sr-status {
  min-height: 1.4em;
  margin: 8px 0 0;
  color: #9fb7c1;
  font-size: 12px;
}

.guided-steps > li {
  padding-bottom: 36px;
}

.completion-check {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 12px;
  font-weight: 700;
}

.lab-records,
.memory-prompts {
  display: grid;
  gap: 0;
}

.criteria-list,
.condition-picker,
.memory-anchors,
.self-assessment {
  display: grid;
  gap: 11px;
  margin: 24px 0 0;
  padding: 19px 20px;
  background: var(--lesson-surface);
  border: 1px solid var(--lesson-line);
  border-radius: 10px;
}

.criteria-list legend,
.condition-picker legend,
.memory-anchors legend,
.self-assessment legend {
  padding: 0 7px;
  font-weight: 780;
}

.criteria-list label,
.condition-picker label,
.memory-anchors label,
.self-assessment label {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.remediation-note {
  margin-top: 18px;
  color: #7b2d27;
  background: var(--lesson-red-pale);
}

.independent-record-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
}

.exercise-list {
  border-top: 1px solid var(--lesson-line-strong);
}

.exercise-item {
  padding: 32px 0 36px;
  border-bottom: 1px solid var(--lesson-line-strong);
}

.exercise-item header > span {
  color: var(--lesson-orange-deep);
  font-size: 13px;
  font-weight: 760;
}

.exercise-item header > small {
  float: right;
  color: var(--lesson-ink-faint);
  font-size: 12px;
}

.exercise-item header h3 {
  max-width: 62ch;
  margin: 9px 0 17px;
  font-size: 20px;
  line-height: 1.55;
}

.hint-button {
  min-height: 44px;
  padding: 0 11px;
  color: var(--lesson-navy);
  background: var(--lesson-blue-pale);
  border: 0;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 700;
}

.hint-text {
  margin: 10px 0 0;
  padding: 12px 14px;
  color: var(--lesson-ink-soft);
  background: var(--lesson-paper);
  border-radius: 7px;
}

.option-list {
  display: grid;
  gap: 9px;
  margin: 18px 0 0;
  padding: 0;
  border: 0;
}

.option-list label {
  align-items: flex-start;
}

.option-list label > span {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 24px;
  height: 24px;
  color: var(--lesson-navy);
  background: var(--lesson-blue-pale);
  border-radius: 4px;
  font-family: var(--lesson-mono);
  font-size: 12px;
}

.exercise-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 18px;
}

.exercise-actions p {
  margin-bottom: 0;
  color: var(--lesson-ink-soft);
  font-size: 13px;
}

.submitted-answer {
  flex: 1 1 100%;
  padding: 12px 14px;
  background: var(--lesson-paper);
  border-radius: 8px;
  overflow-wrap: anywhere;
}

.submitted-answer strong,
.submitted-answer span {
  display: block;
}

.submitted-answer span {
  margin-top: 5px;
  color: var(--lesson-ink);
  font-size: 15px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.feedback-list {
  display: grid;
  gap: 24px;
}

.answer-feedback {
  margin-top: 0;
  padding: 22px;
  background: var(--lesson-paper);
  border-radius: 10px;
}

.answer-feedback.correct {
  color: #174f3e;
  background: var(--lesson-green-pale);
}

.answer-feedback.incorrect {
  color: #6e2924;
  background: var(--lesson-red-pale);
}

.answer-feedback h4 {
  margin-bottom: 12px;
  font-size: 18px;
}

.answer-feedback h5 {
  margin: 17px 0 7px;
  font-size: 15px;
}

.feedback-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(73, 97, 111, .25);
}

.feedback-header > div {
  min-width: 0;
}

.feedback-header span {
  color: inherit;
  font-size: 12px;
  font-weight: 760;
}

.feedback-header h3 {
  margin: 6px 0 0;
  font-size: 19px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.feedback-header > strong {
  flex: 0 0 auto;
  padding: 5px 8px;
  background: rgba(255, 255, 255, .55);
  border-radius: 5px;
  font-size: 12px;
}

.submitted-response {
  padding: 12px 14px;
  background: rgba(255, 255, 255, .58);
  border-radius: 7px;
  overflow-wrap: anywhere;
}

.submitted-response span {
  white-space: pre-wrap;
}

.answer-feedback ol,
.answer-feedback ul {
  padding-left: 21px;
}

.option-rationales {
  margin-top: 20px;
}

.option-rationales article {
  padding: 13px 0;
  border-top: 1px solid rgba(73, 97, 111, .25);
}

.option-rationales article p {
  margin: 5px 0;
}

.option-rationales article small {
  display: block;
  color: inherit;
  opacity: .85;
}

.feedback-columns {
  margin-top: 8px;
}

.remediation-link {
  margin-bottom: 0;
}

.correction-workflow {
  margin-top: 20px;
  padding: 18px;
  color: var(--lesson-ink);
  background: var(--lesson-white);
  border-radius: 9px;
}

.correction-workflow h4 {
  margin-bottom: 8px;
}

.correction-workflow .field-block {
  margin-top: 14px;
}

.feedback-pass {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid rgba(73, 97, 111, .25);
}

.feedback-pass p {
  margin-bottom: 8px;
}

.deliverable-brief dl {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 0;
}

.deliverable-brief dt {
  color: var(--lesson-ink-faint);
  font-size: 12px;
  font-weight: 700;
}

.deliverable-brief dd {
  margin: 2px 0 0;
}

.field-table-wrap {
  max-width: 100%;
  margin-top: 24px;
  border: 1px solid var(--lesson-line-strong);
  border-radius: 9px;
  overflow-x: auto;
}

.field-table {
  width: 100%;
  min-width: 620px;
  border-collapse: collapse;
  font-size: 14px;
}

.field-table th,
.field-table td {
  padding: 11px 13px;
  border-right: 1px solid var(--lesson-line);
  border-bottom: 1px solid var(--lesson-line);
  text-align: left;
  vertical-align: top;
}

.field-table th:last-child,
.field-table td:last-child {
  border-right: 0;
}

.field-table tr:last-child th,
.field-table tr:last-child td {
  border-bottom: 0;
}

.field-table thead th {
  color: #fff;
  background: var(--lesson-navy);
}

.field-table tbody th {
  color: var(--lesson-navy);
  background: var(--lesson-blue-pale);
}

.example-review {
  margin-top: 22px;
  border-top: 1px solid var(--lesson-line);
  border-bottom: 1px solid var(--lesson-line);
}

.example-review summary {
  padding: 16px 4px;
  color: var(--lesson-navy);
  font-weight: 780;
}

.example-review > div {
  padding: 0 4px 20px;
}

.example-review h3 {
  margin: 20px 0 7px;
  font-size: 16px;
}

.example-review pre,
.deliverable-editor textarea {
  font-family: var(--lesson-mono);
  font-size: 13px;
}

.example-review pre {
  max-width: 100%;
  padding: 14px;
  white-space: pre-wrap;
  color: #e8f1f4;
  background: var(--lesson-navy-deep);
  border-radius: 8px;
  overflow: auto;
}

.guided-prompts {
  margin-top: 22px;
  padding: 18px 20px;
  background: var(--lesson-orange-pale);
  border-radius: 9px;
}

.guided-prompts h3 {
  margin-bottom: 7px;
  font-size: 17px;
}

.guided-prompts ol {
  margin-bottom: 0;
  padding-left: 22px;
}

.template-switch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 18px;
  padding: 14px 16px;
  background: var(--lesson-paper);
  border: 1px solid var(--lesson-line);
  border-radius: 9px;
}

.template-switch > span {
  font-weight: 760;
}

.template-switch button[aria-pressed="true"] {
  color: var(--lesson-white);
  background: var(--lesson-navy);
  border-color: var(--lesson-navy);
}

.template-switch small {
  flex-basis: 100%;
  color: var(--lesson-ink-soft);
}

.artifact-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.artifact-message {
  min-height: 1.5em;
  margin: 10px 0 0;
  color: var(--lesson-ink-soft);
  font-size: 13px;
}

.review-schedule {
  margin-top: 26px;
}

.review-schedule h3 {
  margin-bottom: 12px;
  font-size: 18px;
}

.review-schedule ol {
  display: grid;
  gap: 0;
  padding: 0;
  border-top: 1px solid var(--lesson-line-strong);
  list-style: none;
}

.review-schedule li {
  border-bottom: 1px solid var(--lesson-line);
}

.review-schedule label {
  display: grid;
  grid-template-columns: 20px 48px 1fr;
  align-items: start;
  gap: 10px;
  padding: 13px 0;
}

.review-schedule strong {
  color: var(--lesson-orange-deep);
  font-family: var(--lesson-mono);
  font-size: 13px;
}

.completion-section {
  background: var(--lesson-surface);
}

.completion-summary > p {
  font-size: 19px;
}

.completion-summary > p strong {
  color: var(--lesson-orange-deep);
  font-family: var(--lesson-mono);
  font-size: 27px;
}

.completion-summary h3 {
  margin-bottom: 10px;
  font-size: 18px;
}

.completion-summary ul {
  display: grid;
  gap: 8px;
  margin-bottom: 0;
  padding: 0;
  list-style: none;
}

.completion-summary li {
  display: grid;
  grid-template-columns: minmax(150px, .5fr) minmax(0, 1fr);
  gap: 12px;
  padding: 11px 13px;
  background: var(--lesson-white);
  border: 1px solid var(--lesson-line);
  border-radius: 7px;
}

.completion-summary li span {
  color: var(--lesson-ink-soft);
  font-size: 14px;
}

.ready-to-finish {
  padding: 20px;
  color: #174f3e;
  background: var(--lesson-green-pale);
  border-radius: 10px;
}

.ready-to-finish p {
  margin-bottom: 0;
}

.next-lesson {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-top: 24px;
  padding: 22px;
  color: #edf5f7;
  background: var(--lesson-navy);
  border-radius: 10px;
}

.next-lesson h3 {
  margin-bottom: 4px;
  color: #fff;
  font-size: 19px;
}

.next-lesson p {
  margin-bottom: 0;
  color: #bed1d8;
}

.next-lesson .secondary-button {
  flex: 0 0 auto;
  border-color: transparent;
}

.section-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 13px;
  margin-top: 26px;
  padding-top: 20px;
  border-top: 1px solid var(--lesson-line);
}

.section-action p {
  flex: 1 1 280px;
  margin-bottom: 0;
  color: #8a3029;
  font-size: 13px;
}

.primary-button,
.secondary-button {
  min-height: 42px;
  padding: 0 17px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 760;
}

.primary-button {
  color: #fff;
  background: var(--lesson-orange-deep);
  border: 1px solid var(--lesson-orange-deep);
  box-shadow: 0 7px 16px rgba(183, 70, 22, .2);
}

.primary-button:hover:not(:disabled) {
  background: var(--lesson-orange-deep);
  border-color: var(--lesson-orange-deep);
}

.secondary-button {
  color: var(--lesson-navy);
  background: var(--lesson-white);
  border: 1px solid var(--lesson-line-strong);
}

.secondary-button:hover:not(:disabled) {
  background: var(--lesson-blue-pale);
}

.primary-button:disabled,
.secondary-button:disabled,
.daily-lesson button:disabled {
  cursor: not-allowed;
  opacity: .52;
  box-shadow: none;
}

.text-button {
  display: inline;
  padding: 2px 0;
  color: var(--lesson-orange-deep);
  background: transparent;
  border: 0;
  font-weight: 760;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.mobile-toc {
  display: none;
}

.toc-column {
  min-width: 0;
  align-self: stretch;
  background: var(--lesson-navy);
  border-left: 1px solid #214b5f;
  border-radius: 0 14px 14px 0;
}

.toc-panel {
  position: sticky;
  top: 16px;
  max-height: none;
  padding: 12px;
  overflow: visible;
  color: #eaf2f5;
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}

.toc-heading {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 4px 13px;
  border-bottom: 1px solid rgba(220, 234, 240, .16);
}

.toc-heading span {
  color: #ffad85;
  font-size: 15px;
}

.route-progress,
.mobile-route-progress {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  padding: 10px 4px 7px;
}

.route-progress span,
.mobile-route-progress span {
  min-height: 27px;
  display: grid;
  place-items: center;
  padding: 3px 5px;
  color: #a9c0c9;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 6px;
  font-size: 15px;
  line-height: 1.35;
}

.route-progress span.done,
.mobile-route-progress span.done {
  color: #fff;
  background: rgba(255, 255, 255, .12);
  border-color: rgba(255, 255, 255, .2);
  font-weight: 700;
}

.toc-panel ol {
  display: grid;
  gap: 2px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.toc-panel button {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0 7px;
  width: 100%;
  padding: 6px;
  color: #a9c0ca;
  background: transparent;
  border: 0;
  border-radius: 7px;
  text-align: left;
}

.toc-panel button:hover:not(:disabled) {
  color: #fff;
  background: rgba(255, 255, 255, .06);
}

.toc-panel button.complete {
  color: #fff;
  font-weight: 700;
}

.toc-panel button.current {
  color: var(--lesson-navy-deep);
  background: #dce9ee;
  box-shadow: inset 0 0 0 1px #87a7b5;
}

.toc-panel button > span {
  display: grid;
  place-items: center;
  width: 23px;
  height: 23px;
  color: #d8e7ec;
  background: #16435d;
  border-radius: 6px;
  font-size: 15px;
}

.toc-panel button.complete > span {
  color: var(--lesson-navy-deep);
  background: #fff;
}

.toc-panel button.current > span {
  color: var(--lesson-navy-deep);
  background: #fff;
}

.toc-panel button em {
  font-size: 15px;
  font-style: normal;
  font-weight: 700;
}

.toc-panel button small {
  color: #819da8;
  font-size: 15px;
}

.toc-panel button.complete small {
  color: #fff;
}

.toc-panel button.current small,
.toc-panel button.current.complete small {
  color: #426272;
}

.last-saved {
  margin: 13px 4px 0;
  padding-top: 12px;
  color: #819da8;
  border-top: 1px solid rgba(220, 234, 240, .16);
  font-size: 15px;
}

.reset-announcement {
  margin: 18px 0 0;
  padding: 11px 14px;
  color: #174f3e;
  background: var(--lesson-green-pale);
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.55;
}

.reset-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--lesson-line);
}

.reset-row > span {
  flex: 1 1 320px;
  color: var(--lesson-ink-soft);
  font-size: 15px;
  line-height: 1.55;
}

.compact-reset-row {
  margin-top: 16px;
  padding-top: 14px;
}

.reset-button {
  flex: 0 0 auto;
  min-height: 42px;
  padding: 8px 12px;
  color: var(--lesson-ink-soft);
  background: transparent;
  border: 1px solid var(--lesson-line-strong);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 650;
}

.reset-button:hover:not(:disabled) {
  color: var(--lesson-ink);
  background: var(--lesson-paper);
}

.daily-lesson button,
.daily-lesson input,
.daily-lesson textarea,
.daily-lesson select,
.daily-lesson .field-block,
.daily-lesson .option-list label,
.daily-lesson .decision-row label {
  font-size: 16px;
  line-height: 1.68;
}

.daily-lesson input::placeholder,
.daily-lesson textarea::placeholder,
.daily-lesson small,
.daily-lesson dt,
.daily-lesson .lesson-code,
.daily-lesson .section-state,
.daily-lesson .lesson-facts dt,
.daily-lesson .lesson-facts dd,
.daily-lesson .cover-progress,
.daily-lesson .exercise-item header > span,
.daily-lesson .exercise-item header > small,
.daily-lesson .exercise-actions p,
.daily-lesson .artifact-message,
.daily-lesson .deliverable-count,
.daily-lesson .concept-study-action p {
  font-size: 15px;
  line-height: 1.55;
}

.daily-lesson .exercise-item header h3,
.daily-lesson .answer-feedback h3,
.daily-lesson .lab-brief h3,
.daily-lesson .independent-brief h3,
.daily-lesson .deliverable-brief h3,
.daily-lesson .guided-prompts h3,
.daily-lesson .review-schedule h3,
.daily-lesson .next-lesson h3 {
  font-size: 19px;
  line-height: 1.5;
}

@media (max-width: 1080px) {
  .lesson-layout {
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 0;
  }

  .lesson-cover {
    padding-inline: 34px;
  }

  .sandbox-workspace {
    grid-template-columns: 1fr;
  }

  .developer-pane {
    border-top: 1px solid rgba(215, 233, 239, .16);
    border-left: 0;
  }
}

@media (max-width: 860px) {
  .lesson-cover {
    grid-template-columns: 1fr;
  }

  .cover-progress {
    grid-column: auto;
  }

  .lesson-layout {
    grid-template-columns: 1fr;
    background: transparent;
    box-shadow: none;
  }

  .lesson-manuscript {
    border-radius: 11px;
    box-shadow: 0 14px 36px rgba(23, 52, 69, .1);
  }

  .toc-column {
    display: none;
  }

  .mobile-toc {
    position: sticky;
    z-index: 12;
    top: 65px;
    display: block;
    margin-top: 18px;
    color: #e7f0f3;
    background: var(--lesson-navy);
    border: 1px solid #214b5f;
    border-radius: 10px;
    box-shadow: 0 8px 22px rgba(23, 52, 69, .07);
  }

  .mobile-toc[open] {
    position: relative;
    top: auto;
  }

  .mobile-toc > summary {
    padding: 14px 16px;
    color: #fff;
    font-size: 15px;
    font-weight: 760;
  }

  .mobile-toc nav {
    display: grid;
    max-height: none;
    padding: 0 10px 12px;
    overflow: visible;
  }

  .mobile-toc button {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 7px 8px;
    color: #a9c0c9;
    background: transparent;
    border: 0;
    border-top: 1px solid var(--lesson-line);
    text-align: left;
  }

  .daily-lesson .primary-button,
  .daily-lesson .secondary-button,
  .daily-lesson .dev-action,
  .daily-lesson .console-suggestions button,
  .daily-lesson .console-command button,
  .daily-lesson .developer-tabs button,
  .daily-lesson .preview-content > button {
    min-height: 44px;
  }

  .lesson-section {
    scroll-margin-top: 128px;
  }

  .mobile-toc button > span {
    display: grid;
    place-items: center;
    width: 23px;
    height: 23px;
    color: #d8e7ec;
    background: #16435d;
    border-radius: 6px;
    font-size: 15px;
  }

  .mobile-toc button.complete > span {
    color: var(--lesson-navy-deep);
    background: #fff;
  }

  .mobile-toc small {
    color: #a9c0c9;
    font-size: 15px;
  }

  .mobile-toc button.complete {
    color: #fff;
    font-weight: 700;
  }

  .mobile-toc button.current {
    color: var(--lesson-navy-deep);
    background: #dce9ee;
    box-shadow: inset 0 0 0 1px #87a7b5;
  }

  .mobile-toc button.current small {
    color: #426272;
  }
}

@media (max-width: 640px) {
  .daily-lesson {
    font-size: 16px;
  }

  .lesson-cover {
    gap: 20px;
    padding: 26px 22px 24px;
    border-radius: 11px;
  }

  .lesson-title-block h1 {
    font-size: clamp(32px, 10vw, 42px);
  }

  .lesson-subtitle {
    font-size: 16px;
  }

  .lesson-facts div {
    grid-template-columns: 76px 1fr;
  }

  .lesson-manuscript {
    border-radius: 11px;
  }

  .lesson-section {
    padding: 34px 20px 38px;
  }

  .section-heading {
    grid-template-columns: 31px minmax(0, 1fr);
    gap: 10px;
  }

  .completion-heading {
    grid-template-columns: minmax(0, 1fr);
  }

  .completion-heading .section-state {
    grid-column: 1;
  }

  .section-heading > span:first-child {
    width: 31px;
    height: 31px;
  }

  .section-heading h2 {
    font-size: 25px;
  }

  .section-state {
    grid-column: 2;
    justify-self: start;
  }

  .scenario-brief,
  .concept-body,
  .answer-feedback,
  .demo-opening,
  .demo-conclusion,
  .lab-brief,
  .independent-brief,
  .deliverable-brief {
    padding: 18px;
  }

  .feedback-header {
    flex-direction: column;
    gap: 10px;
  }

  .feedback-header > strong {
    align-self: flex-start;
  }

  .scenario-brief blockquote {
    font-size: 18px;
  }

  .concept-list > details > summary {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .concept-foundation,
  .concept-evidence-grid,
  .example-compare,
  .feedback-columns,
  .concept-spec,
  .demo-timeline dl,
  .guided-steps dl,
  .independent-record-grid,
  .deliverable-brief dl {
    grid-template-columns: 1fr;
  }

  .diagram-branches li {
    grid-template-columns: 1fr;
    gap: 4px;
    text-align: left;
  }

  .diagram-branches i {
    width: 1px;
    height: 12px;
    margin-left: 8px;
  }

  .demo-timeline > li,
  .guided-steps > li {
    padding-left: 45px;
  }

  .teaching-sandbox {
    margin-inline: -8px;
  }

  .sandbox-heading {
    display: grid;
    padding: 16px;
  }

  .sandbox-heading > span {
    justify-self: start;
  }

  .preview-pane,
  .elements-panel,
  .console-panel {
    padding: 12px;
  }

  .preview-content {
    min-height: 330px;
    padding: 27px 19px;
  }

  .preview-brand {
    margin-bottom: 32px;
  }

  .console-command > div {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .console-command button {
    grid-column: 2;
    width: 100%;
  }

  .decision-row,
  .artifact-actions,
  .exercise-actions,
  .next-lesson,
  .section-action,
  .concept-study-action,
  .reset-row {
    align-items: stretch;
    flex-direction: column;
  }

  .decision-row label,
  .artifact-actions button,
  .exercise-actions button,
  .next-lesson button,
  .section-action button,
  .concept-study-action button,
  .reset-row button {
    width: 100%;
  }

  .section-action p {
    flex-basis: auto;
  }

  .exercise-item header > small {
    display: block;
    float: none;
    margin-top: 4px;
  }

  .completion-summary li {
    grid-template-columns: 1fr;
  }

  .next-lesson {
    display: flex;
  }
}

@media (max-width: 390px) {
  .lesson-cover {
    margin-inline: -1px;
  }

  .lesson-section {
    padding-inline: 17px;
  }

  .mobile-toc button {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .mobile-toc small {
    grid-column: 2;
  }

  .concept-body,
  .answer-feedback {
    padding: 15px;
  }

  .teaching-sandbox {
    margin-inline: -4px;
  }

  .console-suggestions button {
    flex: 1 1 45%;
  }

  .review-schedule label {
    grid-template-columns: 19px 40px minmax(0, 1fr);
  }
}

.daily-lesson .lesson-cover .lesson-code,
.daily-lesson .lesson-cover dt,
.daily-lesson .lesson-cover dd,
.daily-lesson .lesson-manuscript small,
.daily-lesson .lesson-manuscript dt {
  font-size: 15px;
  line-height: 1.55;
}

@media (prefers-reduced-motion: reduce) {
  .daily-lesson {
    scroll-behavior: auto !important;
  }

  .daily-lesson .signal-line i {
    display: none;
  }
}

@media print {
  .mobile-toc,
  .toc-column,
  .cover-progress,
  .section-action,
  .artifact-actions,
  .exercise-actions,
  .preview-reset,
  .developer-tabs,
  .console-suggestions,
  .console-command,
  .next-lesson button {
    display: none !important;
  }

  .daily-lesson,
  .lesson-manuscript,
  .lesson-cover {
    width: 100%;
    color: #000;
    background: #fff;
    box-shadow: none;
  }

  .lesson-layout {
    display: block;
  }

  .lesson-section {
    break-inside: avoid-page;
    padding-inline: 0;
  }

  .field-table {
    min-width: 0;
  }

  .example-review[open] > div,
  .concept-list details[open] .concept-body {
    display: block;
  }
}

@media (forced-colors: active) {
  .demo-timeline::before,
  .guided-steps::before,
  .diagram-branches i {
    background: CanvasText;
  }

  .primary-button,
  .secondary-button,
  .text-button,
  .toc-panel button,
  .mobile-toc button {
    border: 1px solid ButtonText;
  }
}
</style>
