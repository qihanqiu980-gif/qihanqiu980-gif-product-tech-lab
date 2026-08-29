<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DailyLessonEvidenceState, DailyExerciseEvidence, PrerequisiteDecision } from './DailyLessonView.vue'
import type { DailyCourse, Exercise, LessonSectionId } from '../course/types'
import { getDay01FrameworkPlan, type Day01FrameworkChapter, type Day01ChapterId } from '../course/day01Framework'
import { countSubstantiveContribution } from '../course/evidenceQuality'
import { assessChapterRetell, buildRetellReferenceAnswer } from '../course/retellAssessment'

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? U[]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

interface ChapterEvidence {
  learn: boolean
  selectedIndex: number | null
  practicePassed: boolean
  retell: string
  retellSubmitted: boolean
  retellAttempts: number
}

type W1D4FrameworkEvidence = DailyLessonEvidenceState & {
  frameworkChapters: Record<Day01ChapterId, ChapterEvidence>
}

type ProductView = 'today' | 'course' | 'review' | 'progress' | 'glossary'

const props = withDefaults(defineProps<{
  lesson: DailyCourse
  evidenceState?: DeepPartial<W1D4FrameworkEvidence>
  durationMode?: 30 | 45
  readonly?: boolean
}>(), {
  durationMode: 45,
  readonly: false,
})

const emit = defineEmits<{
  navigate: [view: ProductView]
  'update:evidenceState': [state: DailyLessonEvidenceState]
  'save-attempt': [payload: { lessonId: string; sectionId: LessonSectionId; state: DailyLessonEvidenceState }]
  'section-complete': [payload: { lessonId: string; sectionId: LessonSectionId }]
  'lesson-complete': [payload: { lessonId: string; completedAt: string; state: DailyLessonEvidenceState }]
  'next-lesson-request': [payload: { from: string; to: string }]
}>()

function requireFrameworkPlan() {
  const resolved = getDay01FrameworkPlan(props.lesson.id)
  if (!resolved) throw new Error(`${props.lesson.id} 缺少 Day 01 七章框架。`)
  return resolved
}

const plan = requireFrameworkPlan()

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
  return {
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

function blankEvidence(): W1D4FrameworkEvidence {
  return {
    schemaVersion: 2,
    lessonId: props.lesson.id,
    prerequisiteDecisions: Object.fromEntries(props.lesson.prerequisites.map((item) => [item.id, '' as PrerequisiteDecision])),
    visitedConceptIds: [],
    expandedConceptIds: [],
    completedSections: [],
    sandbox: {
      activePanel: 'elements',
      previewHeadline: 'valid',
      domDraft: 'write-success',
      domEdits: 0,
      ageInput: '9',
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
    exerciseAnswers: Object.fromEntries(props.lesson.exercises.map((exercise) => [exercise.id, blankExerciseEvidence()])),
    deliverable: {
      draft: props.lesson.deliverable.standardTemplate,
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
    frameworkChapters: Object.fromEntries(plan.chapters.map((chapter) => [chapter.id, {
      learn: false,
      selectedIndex: null,
      practicePassed: false,
      retell: '',
      retellSubmitted: false, retellAttempts: 0 }])) as Record<Day01ChapterId, ChapterEvidence>,
  }
}

function safeRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, T> : {}
}

function mergeEvidence(source?: DeepPartial<W1D4FrameworkEvidence>): W1D4FrameworkEvidence {
  const base = blankEvidence()
  if (!source || source.lessonId !== props.lesson.id) return base
  const sourceChapters = safeRecord<Partial<ChapterEvidence>>(source.frameworkChapters)
  const sourceExercises = safeRecord<Partial<DailyExerciseEvidence>>(source.exerciseAnswers)
  return {
    ...base,
    ...source,
    schemaVersion: 2,
    lessonId: props.lesson.id,
    prerequisiteDecisions: { ...base.prerequisiteDecisions, ...safeRecord<PrerequisiteDecision>(source.prerequisiteDecisions) },
    visitedConceptIds: Array.isArray(source.visitedConceptIds) ? source.visitedConceptIds.filter((id): id is string => typeof id === 'string') : [],
    expandedConceptIds: Array.isArray(source.expandedConceptIds) ? source.expandedConceptIds.filter((id): id is string => typeof id === 'string') : [],
    completedSections: Array.isArray(source.completedSections) ? source.completedSections : [],
    sandbox: { ...base.sandbox, ...source.sandbox, consoleHistory: Array.isArray(source.sandbox?.consoleHistory) ? source.sandbox.consoleHistory as W1D4FrameworkEvidence['sandbox']['consoleHistory'] : [] },
    guidedLab: {
      ...base.guidedLab,
      ...source.guidedLab,
      stepComplete: { ...base.guidedLab.stepComplete, ...safeRecord<boolean>(source.guidedLab?.stepComplete) },
      observations: { ...base.guidedLab.observations, ...safeRecord<string>(source.guidedLab?.observations) },
      records: { ...base.guidedLab.records, ...safeRecord<string>(source.guidedLab?.records) },
      passChecks: { ...base.guidedLab.passChecks, ...safeRecord<boolean>(source.guidedLab?.passChecks) },
    },
    independentLab: {
      ...base.independentLab,
      ...source.independentLab,
      passChecks: { ...base.independentLab.passChecks, ...safeRecord<boolean>(source.independentLab?.passChecks) },
    },
    exerciseAnswers: Object.fromEntries(props.lesson.exercises.map((exercise) => [
      exercise.id,
      { ...blankExerciseEvidence(), ...sourceExercises[exercise.id] },
    ])),
    deliverable: {
      ...base.deliverable,
      ...source.deliverable,
      checklist: { ...base.deliverable.checklist, ...safeRecord<boolean>(source.deliverable?.checklist) },
    },
    memory: {
      ...base.memory,
      ...source.memory,
      anchorChecks: { ...base.memory.anchorChecks, ...safeRecord<boolean>(source.memory?.anchorChecks) },
      reviewChecks: { ...base.memory.reviewChecks, ...safeRecord<boolean>(source.memory?.reviewChecks) },
    },
    frameworkChapters: Object.fromEntries(plan.chapters.map((chapter) => [chapter.id, {
      ...base.frameworkChapters[chapter.id],
      ...sourceChapters[chapter.id],
    }])) as Record<Day01ChapterId, ChapterEvidence>,
  }
}

const evidence = ref<W1D4FrameworkEvidence>(mergeEvidence(props.evidenceState))
const activePath = computed(() => props.lesson.learningPaths[String(props.durationMode) as '30' | '45'])
const exerciseSet = computed(() => props.lesson.exercises.slice(0, activePath.value.exerciseCount))
const guidedSteps = computed(() => activePath.value.guidedStepIndices.map((index) => ({ index, step: props.lesson.guidedLab.steps[index] })).filter((item) => item.step))
const guidedRecords = computed(() => activePath.value.guidedRecordIndices.map((index) => ({ index, prompt: props.lesson.guidedLab.recordPrompts[index] })).filter((item) => item.prompt))
const checklistSet = computed(() => activePath.value.deliverableChecklistIndices.map((index) => ({ index, item: props.lesson.deliverable.checklist[index] })).filter((item) => item.item))
const completedChapterCount = computed(() => plan.chapters.filter((chapter) => chapterComplete(chapter)).length)
const totalStatusCount = computed(() => plan.chapters.length * 3)
const completedStatusCount = computed(() => plan.chapters.reduce((total, chapter) => {
  const state = evidence.value.frameworkChapters[chapter.id]
  return total + Number(state.learn) + Number(state.practicePassed) + Number(state.retellSubmitted)
}, 0))
const progressPercent = computed(() => Math.round(completedStatusCount.value / totalStatusCount.value * 100))
const allPrerequisitesPassed = computed(() => props.lesson.prerequisites.every((item) => evidence.value.prerequisiteDecisions[item.id] === 'pass'))
const sessionOneChapters = computed(() => plan.chapters.filter((chapter) => chapter.session === 1))
const sessionTwoChapters = computed(() => plan.chapters.filter((chapter) => chapter.session === 2))
const sessionOneMinutes = computed(() => sessionOneChapters.value.reduce((total, chapter) => total + chapter.timeMinutes, 0))
const sessionTwoMinutes = computed(() => sessionTwoChapters.value.reduce((total, chapter) => total + chapter.timeMinutes, 0))
const visibleCourseMinutes = computed(() => sessionOneMinutes.value + sessionTwoMinutes.value)
const sessionOneTitles = computed(() => sessionOneChapters.value.map((chapter) => chapter.title.replace(/^.*?：/, '')).join('、'))
const sessionTwoTitles = computed(() => sessionTwoChapters.value.map((chapter) => chapter.title.replace(/^.*?：/, '')).join('、'))

function cloneEvidence(): W1D4FrameworkEvidence {
  return JSON.parse(JSON.stringify(evidence.value)) as W1D4FrameworkEvidence
}

function publish() {
  if (syncingExternalState) return
  evidence.value.savedAt = new Date().toISOString()
  emit('update:evidenceState', cloneEvidence())
}

function emitSection(sectionId: LessonSectionId) {
  emit('section-complete', { lessonId: props.lesson.id, sectionId })
}

function saveAttempt(sectionId: LessonSectionId) {
  publish()
  emit('save-attempt', { lessonId: props.lesson.id, sectionId, state: cloneEvidence() })
}

function setSectionComplete(sectionId: LessonSectionId, complete: boolean) {
  const sections = new Set(evidence.value.completedSections)
  if (complete) sections.add(sectionId)
  else sections.delete(sectionId)
  sections.delete('completion')
  evidence.value.completedSections = [...sections]
  delete evidence.value.completedAt
  if (complete) emitSection(sectionId)
}

function conceptsFor(chapter: Day01FrameworkChapter) {
  const ids = new Set(chapter.conceptIds)
  return props.lesson.concepts.filter((concept) => ids.has(concept.id))
}

function syncConceptCompletion() {
  const allVisited = props.lesson.concepts.every((concept) => evidence.value.visitedConceptIds.includes(concept.id))
  setSectionComplete('concepts', allVisited)
}

function toggleChapterLearn(chapter: Day01FrameworkChapter) {
  if (props.readonly) return
  const state = evidence.value.frameworkChapters[chapter.id]
  state.learn = !state.learn

  if (state.learn) {
    evidence.value.visitedConceptIds = [...new Set([...evidence.value.visitedConceptIds, ...chapter.conceptIds])]
    if (chapter.number === 1) {
      setSectionComplete('scenario', true)
      setSectionComplete('objectives', true)
      setSectionComplete('prerequisites', allPrerequisitesPassed.value)
    }
    if (chapter.number === 3) setSectionComplete('diagram', true)
    if (chapter.number === 5) setSectionComplete('demonstration', true)
  } else {
    const retainedConceptIds = new Set(plan.chapters
      .filter((item) => item.id !== chapter.id && evidence.value.frameworkChapters[item.id].learn)
      .flatMap((item) => item.conceptIds))
    evidence.value.visitedConceptIds = evidence.value.visitedConceptIds.filter((id) => retainedConceptIds.has(id))
    if (chapter.number === 1) {
      setSectionComplete('scenario', false)
      setSectionComplete('objectives', false)
      setSectionComplete('prerequisites', false)
    }
    if (chapter.number === 3) setSectionComplete('diagram', false)
    if (chapter.number === 5) setSectionComplete('demonstration', false)
  }
  syncConceptCompletion()
  publish()
}

function updatePrerequisite() {
  const learned = evidence.value.frameworkChapters['chapter-1'].learn
  setSectionComplete('prerequisites', learned && allPrerequisitesPassed.value)
  publish()
}

function submitChapterPractice(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  if (state.selectedIndex === null) return
  state.practicePassed = state.selectedIndex === chapter.practice.answerIndex
  announcement.value = state.practicePassed ? `第 ${chapter.number} 章练习通过。` : `第 ${chapter.number} 章需要再看一次解释后重试。`
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
  state.selectedIndex = null
  state.practicePassed = false
  state.retell = ''
  state.retellSubmitted = false
  state.retellAttempts = 0
  announcement.value = `第 ${chapter.number} 章练习与复述已清空；历史正式提交未删除。`
  publish()
}

function chapterComplete(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  return state.learn && state.practicePassed && state.retellSubmitted
}

function chapterStatusLabel(chapter: Day01FrameworkChapter) {
  const state = evidence.value.frameworkChapters[chapter.id]
  if (chapterComplete(chapter)) return '三项完成'
  return `${Number(state.learn) + Number(state.practicePassed) + Number(state.retellSubmitted)}/3`
}

function exerciseState(exercise: Exercise) {
  return evidence.value.exerciseAnswers[exercise.id]
}

function submitExercise(exercise: Exercise) {
  const state = exerciseState(exercise)
  if (exercise.kind === 'single-choice' && state.selectedIndex === null) return
  if (exercise.kind !== 'single-choice' && state.response.trim().length < 12) return
  state.submitted = true
  state.attemptCount += 1
  state.submittedAt = new Date().toISOString()
  state.selfAssessment = exercise.kind === 'single-choice'
    ? state.selectedIndex === exercise.answerIndex ? 'pass' : 'retry'
    : 'partial'
  syncExerciseCompletion()
  publish()
}

function markOpenExercisePassed(exercise: Exercise) {
  const state = exerciseState(exercise)
  if (!state.submitted) return
  state.selfAssessment = 'pass'
  syncExerciseCompletion()
  publish()
}

function resetExercise(exercise: Exercise) {
  evidence.value.exerciseAnswers[exercise.id] = blankExerciseEvidence()
  syncExerciseCompletion()
  announcement.value = '本题已清空，可从未作答状态重做；历史正式尝试未删除。'
  publish()
}

function syncExerciseCompletion() {
  const ready = exerciseSet.value.every((exercise) => {
    const state = exerciseState(exercise)
    return state.submitted && state.selfAssessment === 'pass'
  })
  setSectionComplete('exercises', ready)
  setSectionComplete('feedback', ready)
}

const processingRun = computed(() => {
  const scenario = evidence.value.sandbox.previewHeadline === 'out-of-range' ? 'out-of-range' : 'valid'
  const writeFails = evidence.value.sandbox.domDraft === 'write-failure'
  const beforePage = Number(evidence.value.sandbox.ageInput || 9)
  const requestedPage = scenario === 'out-of-range' ? 41 : 12
  const rule = scenario === 'out-of-range' ? 'REJECTED · 41 > 36' : 'ALLOWED · 12 ≤ 36'
  const write = scenario === 'out-of-range' ? 'NOT_RUN' : writeFails ? 'WRITE_FAILED' : 'WRITE_CONFIRMED'
  const afterPage = write === 'WRITE_CONFIRMED' ? requestedPage : beforePage
  const status = scenario === 'out-of-range' ? 422 : writeFails ? 503 : 200
  const code = scenario === 'out-of-range' ? 'PAGE_OUT_OF_RANGE' : writeFails ? 'SAVE_UNAVAILABLE' : 'PROGRESS_SAVED'
  const tone = status === 200 ? 'success' as const : 'error' as const
  return {
    scenario,
    request: `POST /api/reading-progress · { documentId: “guide-01”, page: ${requestedPage} }`,
    api: 'MATCHED · SaveReadingProgressHandler',
    backend: 'SERVICE_STARTED · ReadingProgressService',
    rule,
    before: `{ documentId: “guide-01”, page: ${beforePage} }`,
    write,
    after: `{ documentId: “guide-01”, page: ${afterPage} }`,
    response: `${status} · ${code} · page=${afterPage}`,
    tone,
  }
})

const processingCoverage = computed(() => {
  const outputs = evidence.value.sandbox.consoleHistory.map((entry) => entry.output)
  return {
    validWrite: outputs.some((output) => output.includes('WRITE_CONFIRMED') && output.includes('PROGRESS_SAVED')),
    ruleRejected: outputs.some((output) => output.includes('REJECTED') && output.includes('PAGE_OUT_OF_RANGE')),
    writeFailed: outputs.some((output) => output.includes('WRITE_FAILED') && output.includes('SAVE_UNAVAILABLE')),
  }
})

function runProcessingLab() {
  const result = processingRun.value
  evidence.value.sandbox.buttonState = 'success'
  evidence.value.sandbox.buttonClicks += 1
  evidence.value.sandbox.consoleHistory.push({
    command: `教学模拟 #${evidence.value.sandbox.buttonClicks} · ${result.scenario === 'valid' ? '合法页码' : '越界页码'}`,
    output: `${result.api} → ${result.rule} → ${result.write} → ${result.response}`,
    tone: result.tone,
  })
  evidence.value.guidedLab.observations['processing-result'] = `${result.request} → ${result.api} → ${result.backend} → ${result.rule} → ${result.write} → ${result.response}`
  publish()
}

function resetProcessingLab() {
  evidence.value.sandbox = blankEvidence().sandbox
  evidence.value.guidedLab = blankEvidence().guidedLab
  setSectionComplete('guided-lab', false)
  announcement.value = '教学请求处理台已清空，可重新预测、运行链路和记录。'
  publish()
}

function completeGuidedLab() {
  const stepsReady = guidedSteps.value.every(({ index }) => evidence.value.guidedLab.stepComplete[String(index)])
  const recordsReady = guidedRecords.value.every(({ index }) => (evidence.value.guidedLab.records[String(index)] || '').trim().length >= 8)
  const variantsReady = Object.values(processingCoverage.value).every(Boolean)
  if (evidence.value.guidedLab.prediction.trim().length < 12 || !variantsReady || !stepsReady || !recordsReady) {
    announcement.value = '先完成预测、合法保存、规则拒绝、数据库写入失败三条教学模拟，以及全部步骤和实验记录。'
    return
  }
  setSectionComplete('guided-lab', true)
  saveAttempt('guided-lab')
  announcement.value = '引导实验已形成实操证据；它仍只证明本课教学模拟中的请求处理与持久化关系。'
}

function completeIndependentLab() {
  const state = evidence.value.independentLab
  const checksReady = props.lesson.independentLab.passCriteria.every((_, index) => state.passChecks[String(index)])
  if (![state.changedCondition, state.prediction, state.plan, state.evidence, state.result, state.conclusion].every((value) => value.trim().length >= 8) || !checksReady) {
    announcement.value = '独立变式需要写完整条件、预测、计划、证据、结果、结论并完成自检。'
    return
  }
  setSectionComplete('independent-lab', true)
  saveAttempt('independent-lab')
  announcement.value = '独立变式已记录，结论仍需按证据边界审核。'
}

function resetIndependentLab() {
  evidence.value.independentLab = blankEvidence().independentLab
  setSectionComplete('independent-lab', false)
  announcement.value = '独立变式已清空，可从改变条件重新开始。'
  publish()
}

function useDeliverableTemplate(kind: 'guided' | 'blank') {
  evidence.value.deliverable.templateKind = kind
  evidence.value.deliverable.draft = kind === 'guided' ? props.lesson.deliverable.standardTemplate : props.lesson.deliverable.blankTemplate
  evidence.value.deliverable.touched = false
  evidence.value.deliverable.checklist = {}
  setSectionComplete('deliverable', false)
  publish()
}

const deliverableContribution = computed(() => countSubstantiveContribution(
  evidence.value.deliverable.draft,
  evidence.value.deliverable.templateKind === 'blank' ? props.lesson.deliverable.blankTemplate : props.lesson.deliverable.standardTemplate,
))

function completeDeliverable() {
  const checksReady = checklistSet.value.every(({ index }) => evidence.value.deliverable.checklist[String(index)])
  if (deliverableContribution.value < activePath.value.deliverableMinimumContributionCharacters || !checksReady) {
    announcement.value = `成果需要至少 ${activePath.value.deliverableMinimumContributionCharacters} 个有效实写字符，并完成当前路径自检。`
    return
  }
  setSectionComplete('deliverable', true)
  saveAttempt('deliverable')
  announcement.value = '请求处理链路说明已作为待审核工作成果保存。'
}

function resetDeliverable() {
  useDeliverableTemplate('guided')
  announcement.value = '今日成果已恢复为初始引导模板；历史提交未删除。'
}

function completeMemory() {
  const anchorReady = props.lesson.memory.anchors.every((_, index) => evidence.value.memory.anchorChecks[String(index)])
  const reviewReady = props.lesson.memory.reviewStages.every((_, index) => evidence.value.memory.reviewChecks[String(index)])
  if (!anchorReady || !reviewReady || evidence.value.memory.closedBook.trim().length < 60 || evidence.value.memory.microOperation.trim().length < 16) {
    announcement.value = '先完成记忆锚点、至少 60 字闭卷解释、微操作与六阶段复习确认。'
    return
  }
  setSectionComplete('memory', true)
  saveAttempt('memory')
  announcement.value = '最终复述已进入待复核，不直接表示掌握。'
}

function resetMemory() {
  evidence.value.memory = blankEvidence().memory
  setSectionComplete('memory', false)
  announcement.value = '闭卷复述与复习计划已清空；历史正式提交未删除。'
  publish()
}

const canCompleteCourse = computed(() => {
  const chapterReady = plan.chapters.every((chapter) => chapterComplete(chapter))
  const requiredSections: LessonSectionId[] = [
    'scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration',
    'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory',
  ]
  return chapterReady && requiredSections.every((sectionId) => evidence.value.completedSections.includes(sectionId))
})

function completeCourse() {
  if (!canCompleteCourse.value) return
  const completedAt = new Date().toISOString()
  evidence.value.completedSections = [...new Set<LessonSectionId>([...evidence.value.completedSections, 'completion'])]
  evidence.value.completedAt = completedAt
  publish()
  emit('lesson-complete', { lessonId: props.lesson.id, completedAt, state: cloneEvidence() })
}

function goToChapter(chapter: Day01FrameworkChapter) {
  activeChapterId.value = chapter.id
  if (mobileRoute.value?.open) mobileRoute.value.open = false
  void nextTick(() => {
    const element = document.getElementById(`${props.lesson.id.toLowerCase()}-${chapter.id}`)
    if (!element) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scrollOwner = lessonRoot.value?.closest<HTMLElement>('.main-canvas')
    if (scrollOwner) {
      const appbarHeight = lessonRoot.value?.querySelector<HTMLElement>('.w1-appbar')?.offsetHeight ?? 0
      const routeHeight = deviceMode.value === 'mobile' ? (mobileRoute.value?.offsetHeight ?? 0) : 0
      const stickyOffset = deviceMode.value === 'mobile' ? appbarHeight + routeHeight + 8 : 0
      const targetTop = element.getBoundingClientRect().top - scrollOwner.getBoundingClientRect().top + scrollOwner.scrollTop - stickyOffset
      scrollOwner.scrollTo({ top: targetTop, behavior: reduceMotion ? 'auto' : 'smooth' })
    } else {
      element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }
    window.setTimeout(() => element.focus({ preventScroll: true }), reduceMotion ? 0 : 520)
  })
}

function syncActiveChapterFromScroll() {
  const anchor = deviceMode.value === 'mobile' ? 160 : 96
  const chapters = [...(lessonRoot.value?.querySelectorAll<HTMLElement>('[data-framework-chapter]') ?? [])]
  const current = chapters.reduce<HTMLElement | undefined>((nearest, element) => (
    element.getBoundingClientRect().top <= anchor ? element : nearest
  ), chapters[0])
  const id = current?.getAttribute('data-framework-chapter') as Day01ChapterId | null
  if (id) activeChapterId.value = id
}

function onScrollOwnerScroll() {
  if (scrollFrame !== undefined) return
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = undefined
    syncActiveChapterFromScroll()
  })
}

function observeChapters() {
  chapterObserver?.disconnect()
  if (!('IntersectionObserver' in window)) return
  scrollOwner?.removeEventListener('scroll', onScrollOwnerScroll)
  scrollOwner = lessonRoot.value?.closest<HTMLElement>('.main-canvas') ?? null
  scrollOwner?.addEventListener('scroll', onScrollOwnerScroll, { passive: true })
  chapterObserver = new IntersectionObserver(syncActiveChapterFromScroll, { root: scrollOwner, rootMargin: '-80px 0px -55% 0px', threshold: [0, .08, .25] })
  lessonRoot.value?.querySelectorAll<HTMLElement>('[data-framework-chapter]').forEach((element) => chapterObserver?.observe(element))
  syncActiveChapterFromScroll()
}

function syncDeviceMode() {
  deviceMode.value = window.innerWidth <= 860 ? 'mobile' : 'desktop'
}

watch(() => props.evidenceState, (source) => {
  if (!source) return
  const incoming = mergeEvidence(source)
  if (JSON.stringify(incoming) === JSON.stringify(evidence.value)) return
  syncingExternalState = true
  evidence.value = incoming
  void nextTick(() => { syncingExternalState = false })
}, { deep: true })

onMounted(() => {
  syncDeviceMode()
  window.addEventListener('resize', syncDeviceMode)
  observeChapters()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncDeviceMode)
  scrollOwner?.removeEventListener('scroll', onScrollOwnerScroll)
  if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame)
  chapterObserver?.disconnect()
})
</script>

<template>
  <article
    ref="lessonRoot"
    class="day01-course"
    :data-device="deviceMode"
    :aria-labelledby="`${lesson.id}-title`"
  >
    <aside class="w1-global-sidebar" aria-label="主要导航">
      <button class="w1-global-brand" type="button" aria-label="产品技术实验室" @click="emit('navigate', 'today')">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h9v9H5zM18 7.5h9M18 12h9M18 16.5h6M5 20.5h22M5 25h15" /></svg>
        <span><strong>产品技术</strong><small>实验室</small></span>
      </button>
      <nav class="w1-global-nav">
        <button type="button" @click="emit('navigate', 'today')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v14H4zM8 3.5v4M16 3.5v4M4 9.5h16M8 13h3M8 16h6" /></svg><span>今日</span></button>
        <button type="button" class="is-current" aria-current="page" @click="emit('navigate', 'course')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h5M11 12h5" /></svg><span>课程</span></button>
        <button type="button" @click="emit('navigate', 'review')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 8V3M5 8h5M12 7v5l3 2" /></svg><span>复盘</span></button>
        <button type="button" @click="emit('navigate', 'progress')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7M3 19.5h18" /></svg><span>进度</span></button>
        <button type="button" @click="emit('navigate', 'glossary')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h4M11 12h3" /></svg><span>概念</span></button>
      </nav>
      <div class="w1-global-footer">
        <div class="w1-weight-key" aria-label="学习能力权重">
          <span><i></i>数据 40%</span><span><i></i>沟通 30%</span><span><i></i>评审 30%</span>
        </div>
        <button class="w1-archive-action" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 11l4 4 4-4M5 19h14" /></svg><span>旧课档案</span></button>
      </div>
    </aside>

    <div class="w1-window">
      <header class="w1-appbar">
        <button type="button" class="w1-brand" @click="emit('navigate', 'today')"><span class="w1-brand-mark">PL</span><strong>产品技术实验室</strong></button>
        <span class="w1-appbar-meta">COURSE / W1D4</span>
      </header>

      <div class="w1-shell">
        <main class="w1-main">
          <header class="course-cover">
            <div>
              <p class="eyebrow">WEEK 1 · DAY 4 · 双时段课程</p>
              <h1 :id="`${lesson.id}-title`">{{ lesson.title }}</h1>
              <p class="subtitle">{{ lesson.subtitle }}</p>
            </div>
            <div class="cover-summary" aria-label="课程时间比例">
              <div class="cover-summary-head"><strong>{{ visibleCourseMinutes }} 分钟</strong><span>建议分两次完成</span></div>
              <div class="cover-progress"><i :style="{ width: `${progressPercent}%` }"></i></div>
              <div class="cover-summary-labels"><span>本次专注 {{ durationMode }} 分钟</span><span>两时段 · 七章</span></div>
              <div class="cover-evidence"><span>已学习 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].learn).length }}/7</span><span>练习通过 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].practicePassed).length }}/7</span><span>待复核复述 {{ plan.chapters.filter((chapter) => evidence.frameworkChapters[chapter.id].retellSubmitted).length }}/7</span><span>掌握未判定</span></div>
            </div>
          </header>

          <section class="session-strip" aria-label="两个学习时段">
            <div class="session-card"><strong>第一时段 · {{ sessionOneMinutes }} 分钟</strong><span>{{ sessionOneTitles }}</span></div>
            <div class="session-card"><strong>第二时段 · {{ sessionTwoMinutes }} 分钟</strong><span>{{ sessionTwoTitles }}</span></div>
          </section>

          <details ref="mobileRoute" class="w1-mobile-route">
            <summary>章节目录 · {{ plan.chapters.findIndex((chapter) => chapter.id === activeChapterId) + 1 }} / 7 {{ plan.chapters.find((chapter) => chapter.id === activeChapterId)?.title }}</summary>
            <nav class="w1-route-list" aria-label="W1D4 移动端七章目录">
              <button v-for="chapter in plan.chapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)">
                <span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span>
                <span class="w1-route-states" aria-label="本章状态">
                  <span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span>
                  <span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span>
                  <span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span>
                </span>
              </button>
            </nav>
          </details>

          <div class="course-protocol"><span>连续教材流</span><p>每章按“工作问题 → API／后端职责 → 业务规则 → 数据库读写 → 完整示范 → 失败对照 → 自主复述”推进。可提前观看全文，前置不足只提示补学。</p></div>

          <p v-if="announcement" class="announcement" role="status" aria-live="polite">{{ announcement }}</p>

          <div class="manuscript">
        <section
          v-for="chapter in plan.chapters"
          :id="`${lesson.id.toLowerCase()}-${chapter.id}`"
          :key="chapter.id"
          class="framework-chapter"
          :data-framework-chapter="chapter.id"
          tabindex="-1"
        >
          <header class="chapter-head">
            <div>
              <span>SESSION {{ String(chapter.session).padStart(2, '0') }} · CHAPTER {{ String(chapter.number).padStart(2, '0') }}</span>
              <h2>{{ chapter.title }}</h2>
              <p>{{ chapter.lead }}</p>
            </div>
            <strong>{{ chapter.timeMinutes }} MIN</strong>
          </header>

          <template v-if="chapter.number === 1">
            <div class="scenario-copy">
              <p><b>你的角色</b>{{ lesson.scenario.role }}</p>
              <p><b>发生了什么</b>{{ lesson.scenario.situation }}</p>
              <blockquote>{{ lesson.scenario.question }}</blockquote>
              <p><b>为什么重要</b>{{ lesson.scenario.stakes }}</p>
            </div>
            <div class="plain-section">
              <h3>学完后要交出的证据</h3>
              <ol class="objective-list"><li v-for="objective in lesson.objectives" :key="objective.id"><strong>{{ objective.text }}</strong><span>{{ objective.evidence }}</span></li></ol>
            </div>
            <div class="prerequisite-panel">
              <div><h3>前置只做提醒，不锁全文</h3><p>如实选择。需要补课时仍能向后预览，但正式完成本课前需要回来确认。</p></div>
              <fieldset v-for="item in lesson.prerequisites" :key="item.id">
                <legend>{{ item.prompt }}</legend>
                <p>{{ item.passDescription }}</p>
                <div class="decision-row">
                  <label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="pass" :disabled="readonly" @change="updatePrerequisite">已能独立做到</label>
                  <label><input v-model="evidence.prerequisiteDecisions[item.id]" type="radio" :name="item.id" value="remediate" :disabled="readonly" @change="updatePrerequisite">需要先补课</label>
                </div>
                <details v-if="evidence.prerequisiteDecisions[item.id] === 'remediate'" class="remediation" open>
                  <summary>{{ item.remediationLabel }}</summary>
                  <p>{{ item.remediation.purpose }}</p>
                  <ol><li v-for="step in item.remediation.steps" :key="step">{{ step }}</li></ol>
                  <p><b>补做成功：</b>{{ item.remediation.successCheck }}</p>
                </details>
              </fieldset>
            </div>
          </template>

          <template v-if="[2, 3, 5].includes(chapter.number)">
            <div class="concept-ledger">
              <article v-for="concept in conceptsFor(chapter)" :id="`concept-${concept.id}`" :key="concept.id">
                <header><div><h3>{{ concept.term }}</h3><small>{{ concept.english }}</small></div><span>{{ concept.systemPosition }}</span></header>
                <p class="concept-definition">{{ concept.definition }}</p>
                <div class="concept-why"><p><b>为什么存在</b>{{ concept.why }}</p><p><b>解决什么</b>{{ concept.problemSolved }}</p></div>
                <dl><div><dt>输入</dt><dd>{{ concept.input }}</dd></div><div><dt>输出</dt><dd>{{ concept.output }}</dd></div><div><dt>主要负责者</dt><dd>{{ concept.owner }}</dd></div><div><dt>不负责什么</dt><dd>{{ concept.notResponsibleFor }}</dd></div></dl>
                <div class="concept-process"><h4>一步步怎样工作</h4><ol><li v-for="step in concept.process" :key="step">{{ step }}</li></ol></div>
                <div class="example-pair"><div><b>正确例子</b><p>{{ concept.correctExample }}</p></div><div><b>常见越界</b><p>{{ concept.incorrectExample }}</p></div></div>
                <p class="pm-use"><b>产品经理什么时候用：</b>{{ concept.pmUse }}</p>
              </article>
            </div>
          </template>

          <figure v-if="chapter.number === 5" class="relationship-map">
            <figcaption><strong>{{ lesson.diagram.title }}</strong><span>{{ lesson.diagram.caption }}</span></figcaption>
            <ol><li v-for="node in lesson.diagram.nodes" :key="node.id"><strong>{{ node.label }}</strong><p>{{ node.description }}</p><small>输入：{{ node.input }} · 输出：{{ node.output }}</small></li></ol>
            <ul><li v-for="branch in lesson.diagram.branches" :key="`${branch.from}-${branch.to}-${branch.label}`" :class="branch.kind"><span>{{ branch.from }}</span><i>→</i><b>{{ branch.label }}</b><i>→</i><span>{{ branch.to }}</span></li></ul>
            <div><b>读图时找这些证据</b><p v-for="note in lesson.diagram.evidenceNotes" :key="note">{{ note }}</p></div>
          </figure>

          <div v-if="chapter.number === 4" class="understanding-map" aria-label="W1D4 请求处理理解图">
            <span>HTTP Request</span><i>→</i><span>API 入口</span><i>→</i><span>后端业务规则</span><i>→</i><span>数据库读写</span><i>→</i><span>Response</span>
            <p>API 命中、规则通过、写入确认与 Response 是四层不同证据；只有数据库确认和运行后记录才能支持本次教学模拟的持久化结论。</p>
          </div>

          <template v-if="chapter.number === 5">
            <div class="demonstration">
              <h3>{{ lesson.demonstration.title }}</h3>
              <p><b>业务问题：</b>{{ lesson.demonstration.businessProblem }}</p>
              <ol><li v-for="(step, index) in lesson.demonstration.steps" :key="step.title"><span>{{ index + 1 }}</span><div><h4>{{ step.title }}</h4><p><b>教师操作：</b>{{ step.action }}</p><p><b>为什么：</b>{{ step.reason }}</p><p><b>看到：</b>{{ step.evidence }}</p><p><b>能证明：</b>{{ step.proves }}</p><p><b>不能证明：</b>{{ step.limitation }}</p></div></li></ol>
              <div id="demonstration-conclusion" class="limited-conclusion"><p><b>有限结论：</b>{{ lesson.demonstration.finalConclusion }}</p><p><b>结论限制：</b>{{ lesson.demonstration.conclusionLimit }}</p></div>
            </div>
            <div class="lab-panel">
              <div class="lab-title"><div><span>教学模拟</span><h3>{{ lesson.guidedLab.title }}</h3><p>{{ lesson.guidedLab.goal }}</p></div><small>{{ lesson.guidedLab.safety }}</small></div>
              <label class="field"><span>先预测</span><small>{{ lesson.guidedLab.predictionPrompt }}</small><textarea v-model="evidence.guidedLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label>
              <div class="http-console">
                <p class="simulation-label">教学模拟 · 不发送真实请求，不连接真实服务器或数据库</p>
                <div class="request-controls">
                  <label><span>教学请求条件</span><select v-model="evidence.sandbox.previewHeadline" :disabled="readonly" @change="evidence.sandbox.buttonState = 'idle'; publish()"><option value="valid">合法页码 12 / 36</option><option value="out-of-range">越界页码 41 / 36</option></select></label>
                  <label><span>教学数据库结果</span><select v-model="evidence.sandbox.domDraft" :disabled="readonly" @change="evidence.sandbox.buttonState = 'idle'; publish()"><option value="write-success">写入确认</option><option value="write-failure">写入失败</option></select></label>
                  <label><span>运行前记录 page</span><input v-model="evidence.sandbox.ageInput" inputmode="numeric" :disabled="readonly" aria-label="教学模拟数据库运行前页码" @input="evidence.sandbox.buttonState = 'idle'; publish()"></label>
                  <label><span>链路视图</span><select v-model="evidence.sandbox.activePanel" :disabled="readonly" @change="publish()"><option value="elements">显示全部阶段</option><option value="console">强调失败分支</option></select></label>
                </div>
                <div class="message-ledger"><p><span>HTTP Request · 教学模拟</span><b>{{ processingRun.request }}</b></p><p><span>API 与处理器 · 教学模拟</span><b>{{ processingRun.api }}</b></p><p><span>后端业务服务 · 教学模拟</span><b>{{ processingRun.backend }}</b></p><p><span>业务规则 · 教学模拟</span><b>{{ processingRun.rule }}</b></p></div>
                <div class="console-actions"><button type="button" :disabled="readonly" @click="runProcessingLab">运行教学处理链</button><button type="button" class="secondary" :disabled="readonly" @click="resetProcessingLab">清空实验</button></div>
                <dl v-if="evidence.sandbox.buttonState === 'success'" class="response-result"><div><dt>数据库运行前 · 教学模拟</dt><dd>{{ processingRun.before }}</dd></div><div><dt>数据库写入 · 教学模拟</dt><dd>{{ processingRun.write }}</dd></div><div><dt>数据库运行后 · 教学模拟</dt><dd>{{ processingRun.after }}</dd></div><div><dt>Response · 教学模拟</dt><dd>{{ processingRun.response }}</dd></div></dl>
                <ol v-if="evidence.sandbox.consoleHistory.length" class="exchange-history" aria-label="教学模拟请求处理链对照历史"><li v-for="(entry, index) in evidence.sandbox.consoleHistory" :key="`${entry.command}-${index}`"><code>{{ entry.command }}</code><span>{{ entry.output }}</span></li></ol>
                <div class="simulation-coverage" aria-label="教学模拟实验覆盖">
                  <span :class="{ done: processingCoverage.validWrite }">合法保存：{{ processingCoverage.validWrite ? '已运行' : '待运行' }}</span>
                  <span :class="{ done: processingCoverage.ruleRejected }">规则拒绝：{{ processingCoverage.ruleRejected ? '已运行' : '待运行' }}</span>
                  <span :class="{ done: processingCoverage.writeFailed }">数据库写入失败：{{ processingCoverage.writeFailed ? '已运行' : '待运行' }}</span>
                </div>
              </div>
              <ol class="lab-steps"><li v-for="item in guidedSteps" :key="item.index"><label><input v-model="evidence.guidedLab.stepComplete[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish"><span><b>{{ item.step.title }}</b>{{ item.step.action }}</span></label><p>观察：{{ item.step.observe }}</p><small>能证明：{{ item.step.proves }}；不能证明：{{ item.step.cannotProve }}</small></li></ol>
              <div class="record-grid"><label v-for="item in guidedRecords" :key="item.index"><span>{{ item.prompt }}</span><textarea v-model="evidence.guidedLab.records[String(item.index)]" rows="3" :readonly="readonly" @input="publish" /></label></div>
              <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeGuidedLab">保存引导实验尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetProcessingLab">清空并重做</button></div>
            </div>
          </template>

          <template v-if="chapter.number === 6">
            <div class="boundary-table">
              <h3>看到什么，最多判断到哪里</h3>
              <dl><div><dt>API 入口命中</dt><dd>请求进入指定处理路径；不能据此断言业务规则通过或数据已保存。</dd></div><div><dt>业务规则通过</dt><dd>本次输入允许继续；仍要等待数据库写入确认与运行后记录。</dd></div><div><dt>数据库写入确认</dt><dd>支持本次教学模拟记录已改变；不代表任何真实生产数据。</dd></div><div><dt>Response 已组装</dt><dd>服务端形成了返回结果；还不能证明客户端收到或页面正确呈现。</dd></div></dl>
            </div>
            <div class="independent-panel">
              <h3>{{ lesson.independentLab.title }}</h3><p>{{ lesson.independentLab.scenario }}</p>
              <label><span>改变一个条件</span><select v-model="evidence.independentLab.changedCondition" :disabled="readonly" @change="publish"><option value="">请选择</option><option v-for="item in lesson.independentLab.changedConditions" :key="item" :value="item">{{ item }}</option></select></label>
              <label><span>先预测</span><small>{{ lesson.independentLab.predictionPrompt }}</small><textarea v-model="evidence.independentLab.prediction" rows="3" :readonly="readonly" @input="publish" /></label>
              <label><span>操作计划</span><textarea v-model="evidence.independentLab.plan" rows="3" :readonly="readonly" @input="publish" /></label>
              <label><span>原始证据</span><textarea v-model="evidence.independentLab.evidence" rows="3" :readonly="readonly" @input="publish" /></label>
              <label><span>观察结果</span><textarea v-model="evidence.independentLab.result" rows="3" :readonly="readonly" @input="publish" /></label>
              <label><span>有限结论</span><textarea v-model="evidence.independentLab.conclusion" rows="3" :readonly="readonly" @input="publish" /></label>
              <div class="check-list"><label v-for="(item, index) in lesson.independentLab.passCriteria" :key="item"><input v-model="evidence.independentLab.passChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item }}</label></div>
              <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeIndependentLab">保存独立变式尝试</button><button type="button" class="secondary" :disabled="readonly" @click="resetIndependentLab">清空并重做</button></div>
            </div>
          </template>

          <template v-if="chapter.number === 7">
            <div class="practice-workshop">
              <h3>针对性练习</h3><p>先作答，再看逐项解释。错误不会扣分，但必须修正到证据支持的层。</p>
              <article v-for="(exercise, index) in exerciseSet" :key="exercise.id">
                <header><span>{{ index + 1 }}</span><div><h4>{{ exercise.prompt }}</h4><small>{{ exercise.categories.join(' · ') }}</small></div></header>
                <div v-if="exercise.kind === 'single-choice'" class="answer-options"><label v-for="(option, optionIndex) in exercise.options" :key="option.label"><input v-model="exerciseState(exercise).selectedIndex" type="radio" :name="exercise.id" :value="optionIndex" :disabled="readonly || exerciseState(exercise).submitted" @change="publish"><span>{{ String.fromCharCode(65 + optionIndex) }}</span>{{ option.label }}</label></div>
                <textarea v-else v-model="exerciseState(exercise).response" rows="4" :readonly="readonly || exerciseState(exercise).submitted" :aria-label="`练习：${exercise.prompt}`" placeholder="先写你的推理与证据边界" @input="publish" />
                <div v-if="exerciseState(exercise).submitted" :class="['exercise-feedback', exerciseState(exercise).selfAssessment]"><b>{{ exerciseState(exercise).selfAssessment === 'pass' ? '当前通过' : '对照后修正' }}</b><p>{{ exercise.referenceAnswer }}</p><ol><li v-for="reason in exercise.reasoning" :key="reason">{{ reason }}</li></ol><p><b>常见错因：</b>{{ exercise.commonErrors.map((item) => `${item.error}：${item.reason}`).join('；') }}</p></div>
                <div class="panel-actions"><button v-if="!exerciseState(exercise).submitted" type="button" :disabled="readonly" @click="submitExercise(exercise)">提交本题</button><button v-else-if="exercise.kind !== 'single-choice' && exerciseState(exercise).selfAssessment !== 'pass'" type="button" :disabled="readonly" @click="markOpenExercisePassed(exercise)">我已按量规修正</button><button type="button" class="secondary" :disabled="readonly" @click="resetExercise(exercise)">清空并重做</button></div>
              </article>
            </div>

            <div class="deliverable-panel">
              <h3>{{ lesson.deliverable.title }}</h3><p>{{ lesson.deliverable.purpose }}</p>
              <div class="field-ledger"><div v-for="field in lesson.deliverable.fields" :key="field.name"><b>{{ field.name }}</b><p>{{ field.meaning }}</p><small>证据来源：{{ field.source }}</small></div></div>
              <details><summary>先看一份差稿怎样被修正</summary><blockquote>{{ lesson.deliverable.badExample }}</blockquote><ol><li v-for="item in lesson.deliverable.revisionSteps" :key="item">{{ item }}</li></ol><pre>{{ lesson.deliverable.goodExample }}</pre></details>
              <div class="template-actions"><button type="button" :disabled="readonly" @click="useDeliverableTemplate('guided')">使用引导模板</button><button type="button" class="secondary" :disabled="readonly" @click="useDeliverableTemplate('blank')">使用空白模板</button></div>
              <textarea v-model="evidence.deliverable.draft" rows="14" :readonly="readonly" :aria-label="`${lesson.deliverable.title}草稿`" @input="evidence.deliverable.touched = true; publish()" />
              <p class="counter">有效实写 {{ deliverableContribution }} / {{ activePath.deliverableMinimumContributionCharacters }} 字符</p>
              <div class="check-list"><label v-for="item in checklistSet" :key="item.index"><input v-model="evidence.deliverable.checklist[String(item.index)]" type="checkbox" :disabled="readonly" @change="publish">{{ item.item }}</label></div>
              <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeDeliverable">保存今日成果</button><button type="button" class="secondary" :disabled="readonly" @click="resetDeliverable">清空并重做</button></div>
            </div>

            <div class="memory-panel">
              <h3>最终闭卷复述与复习</h3>
              <div class="check-list"><label v-for="(anchor, index) in lesson.memory.anchors" :key="anchor"><input v-model="evidence.memory.anchorChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish">{{ anchor }}</label></div>
              <label><span>{{ lesson.memory.closedBookPrompt }}</span><textarea v-model="evidence.memory.closedBook" rows="6" :readonly="readonly" @input="publish" /></label>
              <label><span>微操作</span><small>{{ lesson.memory.microOperation }}</small><textarea v-model="evidence.memory.microOperation" rows="3" :readonly="readonly" @input="publish" /></label>
              <label><span>{{ lesson.memory.unresolvedPrompt }}</span><textarea v-model="evidence.memory.unresolved" rows="3" :readonly="readonly" @input="publish" /></label>
              <div class="review-timeline"><label v-for="(stage, index) in lesson.memory.reviewStages" :key="stage.stage"><input v-model="evidence.memory.reviewChecks[String(index)]" type="checkbox" :disabled="readonly" @change="publish"><b>{{ stage.stage }}</b><span>{{ stage.task }}</span></label></div>
              <div class="panel-actions"><button type="button" :disabled="readonly" @click="completeMemory">保存待复核复述</button><button type="button" class="secondary" :disabled="readonly" @click="resetMemory">清空并重做</button></div>
            </div>
          </template>

          <div class="chapter-checkpoint">
            <div class="checkpoint-heading"><div><span>CHAPTER CHECK</span><h3>练习一次，再用自己的话讲出来</h3></div><button type="button" class="reset-link" :disabled="readonly" @click="resetChapterCheckpoint(chapter)">清空并重做</button></div>
            <fieldset><legend>{{ chapter.practice.prompt }}</legend><label v-for="(option, index) in chapter.practice.options" :key="option"><input v-model="evidence.frameworkChapters[chapter.id].selectedIndex" type="radio" :name="`${chapter.id}-practice`" :value="index" :disabled="readonly || evidence.frameworkChapters[chapter.id].practicePassed" @change="publish"><span>{{ String.fromCharCode(65 + index) }}</span>{{ option }}</label></fieldset>
            <div class="checkpoint-actions"><button type="button" :disabled="readonly || evidence.frameworkChapters[chapter.id].selectedIndex === null" @click="submitChapterPractice(chapter)">检查练习</button><p v-if="evidence.frameworkChapters[chapter.id].selectedIndex !== null" :class="{ passed: evidence.frameworkChapters[chapter.id].practicePassed }">{{ evidence.frameworkChapters[chapter.id].practicePassed ? chapter.practice.explanation : '当前选择还不能解释机制，请对照本章后重试。' }}</p></div>
            <label class="retell-field"><span>{{ chapter.retellPrompt }}</span><textarea v-model="evidence.frameworkChapters[chapter.id].retell" rows="4" :readonly="readonly" @input="onChapterRetellInput(chapter)" /><small>量规：{{ chapter.retellRubric.join('；') }}</small></label>
            <p v-if="evidence.frameworkChapters[chapter.id].retellAttempts > 0 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-feedback">{{ evidence.frameworkChapters[chapter.id].retellAttempts >= 2 ? '第二次仍未通过，对照参考答案重写后再提交。' : '未通过：按量规补齐后再提交；本次先不显示参考答案。' }}</p><p v-if="evidence.frameworkChapters[chapter.id].retellAttempts >= 2 && !evidence.frameworkChapters[chapter.id].retellSubmitted" class="retell-answer"><b>参考答案</b>{{ buildRetellReferenceAnswer(chapter) }}</p>
            <div class="checkpoint-footer"><button type="button" :disabled="readonly" @click="toggleChapterLearn(chapter)">{{ evidence.frameworkChapters[chapter.id].learn ? '撤销本章学习确认' : '确认已完整学习本章' }}</button><button type="button" :disabled="readonly" @click="submitChapterRetell(chapter)">{{ evidence.frameworkChapters[chapter.id].retellSubmitted ? '复述已记录为待复核' : '保存本章复述' }}</button></div>
          </div>

          <div v-if="chapter.number === 7" class="course-completion">
            <h3>本课完成核验</h3><p>页面完成只表示首学流程完整；真正掌握仍由后续闭卷、实操和迁移证据判定。</p>
            <button type="button" :disabled="readonly || !canCompleteCourse" @click="completeCourse">{{ evidence.completedAt ? '本课首学已完成' : '确认完成 W1D4 首学' }}</button>
            <button v-if="evidence.completedAt && lesson.nextLesson" type="button" class="secondary" @click="emit('next-lesson-request', { from: lesson.id, to: lesson.nextLesson!.id })">打开下一课预览：{{ lesson.nextLesson.title }}</button>
          </div>
            </section>
          </div>
        </main>

        <aside class="w1-route" aria-label="W1D4 七章学习路线">
          <div class="w1-route-head"><strong>W1D4 学习路线</strong><span>7 章 · {{ visibleCourseMinutes }} 分钟 · 状态分开记录</span></div>
          <div class="w1-route-group">
            <strong><span>第一时段</span><span>{{ sessionOneMinutes }} MIN</span></strong>
            <div class="w1-route-list">
              <button v-for="chapter in sessionOneChapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)">
                <span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span>
                <span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span>
              </button>
            </div>
          </div>
          <div class="w1-route-group">
            <strong><span>第二时段</span><span>{{ sessionTwoMinutes }} MIN</span></strong>
            <div class="w1-route-list">
              <button v-for="chapter in sessionTwoChapters" :key="chapter.id" type="button" class="w1-route-item" :aria-current="activeChapterId === chapter.id ? 'location' : undefined" @click="goToChapter(chapter)">
                <span class="w1-route-title"><span>{{ String(chapter.number).padStart(2, '0') }}</span><span>{{ chapter.title }}</span></span>
                <span class="w1-route-states" aria-label="本章状态"><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].learn }]" :aria-label="`学习：${evidence.frameworkChapters[chapter.id].learn ? '已完成' : '未完成'}`">学习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].practicePassed }]" :aria-label="`练习：${evidence.frameworkChapters[chapter.id].practicePassed ? '已完成' : '未完成'}`">练习</span><span :class="['w1-route-state', { 'is-done': evidence.frameworkChapters[chapter.id].retellSubmitted }]" :aria-label="`复述：${evidence.frameworkChapters[chapter.id].retellSubmitted ? '已完成' : '未完成'}`">复述</span></span>
              </button>
            </div>
          </div>
          <div class="w1-route-note"><strong>掌握未判定 · {{ progressPercent }}%</strong><br>学习、练习、复述分开记录；清空重做立即撤销对应高亮。</div>
        </aside>
      </div>
    </div>
  </article>
</template>

<style scoped>
.day01-course { --navy:#05283a; --navy-2:#062f43; --line:#c4d0d4; --paper:#e8edef; --surface:#fbfcfc; --ink:#132d3c; --soft:#4b626d; --orange:#e2672d; --green:#23735b; color:var(--ink); background:var(--paper); font-family:"Noto Sans SC Variable","Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif; }
.course-cover { padding:42px clamp(24px,5vw,68px); color:#fff; background:var(--navy); border-bottom:1px solid #214b5f; }
.eyebrow,.chapter-head span,.checkpoint-heading span,.route-panel header span { margin:0; color:#a9c0c9; font-size:14px; font-weight:800; letter-spacing:.09em; }
.course-cover h1 { max-width:20ch; margin:12px 0 8px; font-size:clamp(34px,4.6vw,52px); line-height:1.16; letter-spacing:-.025em; }
.subtitle { max-width:62ch; margin:0; color:#d7e2e6; font-size:18px; line-height:1.75; }
.cover-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; margin-top:30px; background:#214b5f; border:1px solid #214b5f; }
.cover-grid>div { display:grid; gap:4px; padding:16px 18px; background:#0a3448; }.cover-grid span,.cover-grid small { color:#a9c0c9; font-size:14px; }.cover-grid strong { font-size:19px; }
.cover-progress { height:5px; margin-top:18px; overflow:hidden; background:#214b5f; }.cover-progress i { display:block; height:100%; background:var(--orange); transition:width .2s ease; }
.preview-note { margin:16px 0 0; padding-left:14px; color:#d7e2e6; border-left:3px solid var(--orange); font-size:15px; line-height:1.65; }
.course-layout { display:grid; grid-template-columns:minmax(0,1fr) 244px; align-items:start; max-width:1160px; margin:0 auto; background:var(--surface); }
.manuscript { min-width:0; padding:0 clamp(24px,5vw,62px) 80px; background:var(--surface); }
.framework-chapter { scroll-margin-top:18px; padding:56px 0 8px; border-bottom:1px solid #d7e0e3; outline:none; }.framework-chapter:last-child { border-bottom:0; }
.framework-chapter:focus-visible { outline:3px solid rgba(226,103,45,.35); outline-offset:6px; }
.chapter-head { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; margin-bottom:30px; }.chapter-head>div { max-width:690px; }.chapter-head h2 { margin:8px 0 10px; font-size:clamp(28px,3.6vw,38px); line-height:1.24; letter-spacing:-.018em; }.chapter-head p { margin:0; color:var(--soft); font-size:17px; line-height:1.8; }.chapter-head>strong { flex:0 0 auto; padding:7px 9px; color:var(--navy); border:1px solid var(--line); font-size:14px; }
.scenario-copy { padding:25px 28px; color:#fff; background:var(--navy-2); }.scenario-copy p { display:grid; grid-template-columns:100px 1fr; gap:16px; margin:0; padding:10px 0; color:#d7e2e6; border-bottom:1px solid #214b5f; line-height:1.7; }.scenario-copy p:last-child { border-bottom:0; }.scenario-copy b { color:#fff; }.scenario-copy blockquote { margin:18px 0; padding:18px 20px; background:#fff; color:var(--ink); border-left:4px solid var(--orange); font-size:19px; font-weight:750; line-height:1.6; }
.plain-section { margin-top:28px; }.plain-section h3,.concept-ledger h3,.relationship-map strong,.demonstration>h3,.lab-panel h3,.boundary-table h3,.independent-panel h3,.practice-workshop>h3,.deliverable-panel>h3,.memory-panel>h3 { font-size:22px; line-height:1.45; }
.objective-list { margin:0; padding:0; list-style:none; border-top:1px solid var(--line); }.objective-list li { display:grid; grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr); gap:22px; padding:18px 0; border-bottom:1px solid var(--line); }.objective-list span { color:var(--soft); line-height:1.7; }
.prerequisite-panel,.lab-panel,.independent-panel,.practice-workshop,.deliverable-panel,.memory-panel { margin-top:30px; padding:28px; background:#eef3f4; border:1px solid var(--line); border-radius:13px; }.prerequisite-panel fieldset { margin:22px 0 0; padding:20px; background:#fff; border:1px solid var(--line); }.prerequisite-panel legend { padding:0 8px; font-weight:800; }.decision-row { display:flex; flex-wrap:wrap; gap:10px; }.decision-row label,.answer-options label { display:flex; align-items:center; gap:9px; min-height:44px; padding:10px 12px; background:#fff; border:1px solid var(--line); cursor:pointer; }.remediation { margin-top:14px; padding:14px; background:#fbe8dd; }.remediation summary { font-weight:800; cursor:pointer; }
.concept-ledger { border-top:2px solid var(--navy); }.concept-ledger>article { padding:28px 0 34px; border-bottom:1px solid var(--line); }.concept-ledger header { display:flex; justify-content:space-between; gap:20px; }.concept-ledger h3 { margin:0; }.concept-ledger header small { color:var(--soft); }.concept-ledger header>span { max-width:36ch; color:var(--soft); text-align:right; }.concept-definition { font-size:17px; line-height:1.85; }.concept-why,.example-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }.concept-why p,.example-pair>div { margin:0; padding:18px; background:#eef3f4; line-height:1.75; }.concept-why b,.example-pair b { display:block; margin-bottom:7px; color:var(--navy); }.concept-ledger dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); margin:22px 0; border-top:1px solid var(--line); border-left:1px solid var(--line); }.concept-ledger dl>div { padding:14px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); }.concept-ledger dt { color:var(--soft); font-size:14px; font-weight:800; }.concept-ledger dd { margin:7px 0 0; line-height:1.7; }.concept-process ol { padding-left:22px; }.concept-process li,.pm-use { line-height:1.75; }
.relationship-map { margin:30px 0 0; padding:26px; border:1px solid var(--line); }.relationship-map figcaption { display:grid; gap:6px; }.relationship-map figcaption span { color:var(--soft); line-height:1.7; }.relationship-map>ol { display:grid; grid-template-columns:repeat(3,minmax(180px,1fr)); gap:12px; padding:0; overflow-x:auto; list-style:none; }.relationship-map>ol li { padding:16px; background:#eef3f4; }.relationship-map li p { line-height:1.65; }.relationship-map>ul { padding:0; list-style:none; }.relationship-map>ul li { display:grid; grid-template-columns:1fr auto 1.4fr auto 1fr; align-items:center; gap:8px; padding:10px 0; border-bottom:1px solid var(--line); }.relationship-map li.failure b { color:#ad3c35; }
.understanding-map { display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:28px; color:#fff; background:var(--navy-2); }.understanding-map span { padding:10px 12px; background:#0d3c50; border:1px solid #285469; font-weight:750; }.understanding-map i { color:var(--orange); font-style:normal; }.understanding-map p { flex-basis:100%; margin:14px 0 0; color:#d7e2e6; }
.demonstration { margin-top:28px; }.demonstration>ol { padding:0; list-style:none; }.demonstration>ol>li { display:grid; grid-template-columns:42px 1fr; gap:16px; padding:20px 0; border-bottom:1px solid var(--line); }.demonstration>ol>li>span { display:grid; place-items:center; width:38px; height:38px; color:#fff; background:var(--navy); }.demonstration h4 { margin:0 0 10px; font-size:19px; }.demonstration li p { margin:6px 0; line-height:1.7; }.limited-conclusion { padding:20px; background:#e0f1eb; border-left:4px solid var(--green); }
.lab-title { display:flex; justify-content:space-between; gap:18px; }.lab-title span { display:inline-block; padding:4px 7px; color:#fff; background:var(--navy); font-size:13px; font-weight:800; }.lab-title h3 { margin:8px 0; }.lab-title>small { max-width:32ch; color:var(--soft); line-height:1.6; }.field,.independent-panel>label,.memory-panel>label { display:grid; gap:7px; margin-top:18px; }.field>span,.independent-panel label>span,.memory-panel label>span { font-weight:800; }.field small,.memory-panel small { color:var(--soft); }.day01-course textarea,.day01-course input,.day01-course select { box-sizing:border-box; width:100%; color:var(--ink); background:#fff; border:1px solid #9eafb6; border-radius:8px; font:inherit; }.day01-course textarea { padding:12px; line-height:1.7; resize:vertical; }.day01-course input,.day01-course select { min-height:44px; padding:9px 11px; }.day01-course input[type="radio"],.day01-course input[type="checkbox"] { width:18px; min-height:18px; accent-color:var(--orange); }
.http-console { min-width:0; margin-top:22px; padding:20px; color:#fff; background:var(--navy); }.simulation-label { margin:0 0 14px; color:#a9c0c9; font-size:13px; }.request-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }.http-console label { display:grid; gap:7px; min-width:0; }.http-console select { width:100%; color:var(--ink); }.message-ledger { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin-top:14px; background:#285469; }.message-ledger p { display:grid; gap:4px; min-width:0; margin:0; padding:10px; background:#0a3448; }.message-ledger span { color:#a9c0c9; font-size:13px; }.message-ledger b { overflow-wrap:anywhere; font-size:14px; }.console-actions,.panel-actions,.template-actions,.checkpoint-footer { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }.day01-course button { min-height:42px; padding:9px 14px; color:#fff; background:var(--orange); border:1px solid var(--orange); border-radius:8px; font:inherit; font-weight:800; cursor:pointer; }.day01-course button.secondary,.reset-link { color:var(--navy); background:#fff; border-color:var(--line); }.day01-course button:disabled { cursor:not-allowed; opacity:.5; }.day01-course button:focus-visible,.day01-course input:focus-visible,.day01-course textarea:focus-visible,.day01-course select:focus-visible { outline:3px solid rgba(226,103,45,.35); outline-offset:2px; }.response-result { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); margin:16px 0 0; border-top:1px solid #285469; border-left:1px solid #285469; }.response-result div { min-width:0; padding:10px; border-right:1px solid #285469; border-bottom:1px solid #285469; }.response-result dt { color:#a9c0c9; font-size:13px; }.response-result dd { margin:5px 0 0; overflow-wrap:anywhere; }.exchange-history { margin:14px 0 0; padding:0; list-style:none; border-top:1px solid #285469; }.exchange-history li { display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:12px; padding:9px 0; border-bottom:1px solid #285469; }.exchange-history code,.exchange-history span { overflow-wrap:anywhere; }.exchange-history span { color:#c7d7de; }.simulation-coverage { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }.simulation-coverage span { padding:5px 8px; color:#a9c0c9; border:1px solid #285469; border-radius:6px; font-size:13px; }.simulation-coverage span.done { color:#fff; background:#23735b; border-color:#23735b; }.lab-steps { padding:0; list-style:none; }.lab-steps li { padding:16px 0; border-bottom:1px solid var(--line); }.lab-steps label { display:flex; align-items:flex-start; gap:10px; }.lab-steps label span { line-height:1.7; }.lab-steps label b { display:block; }.lab-steps p,.lab-steps small { display:block; margin:8px 0 0 28px; line-height:1.65; }.record-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }.record-grid label { display:grid; gap:7px; }.record-grid span { font-weight:750; }
.boundary-table dl { border-top:2px solid var(--navy); }.boundary-table dl>div { display:grid; grid-template-columns:180px 1fr; gap:20px; padding:16px 0; border-bottom:1px solid var(--line); }.boundary-table dt { font-weight:800; }.boundary-table dd { margin:0; line-height:1.7; }.check-list { display:grid; gap:9px; margin-top:16px; }.check-list label { display:flex; align-items:flex-start; gap:9px; line-height:1.6; }
.practice-workshop>article { margin-top:18px; padding:20px; background:#fff; border:1px solid var(--line); }.practice-workshop article header { display:flex; gap:12px; }.practice-workshop article header>span { display:grid; place-items:center; flex:0 0 34px; height:34px; color:#fff; background:var(--navy); }.practice-workshop h4 { margin:0; font-size:18px; }.practice-workshop header small { color:var(--soft); }.answer-options { display:grid; gap:9px; margin-top:14px; }.answer-options label span { display:grid; place-items:center; width:28px; height:28px; color:var(--navy); background:#eef3f4; font-weight:800; }.exercise-feedback { margin-top:14px; padding:16px; background:#fbe8dd; }.exercise-feedback.pass { background:#e0f1eb; }.exercise-feedback p,.exercise-feedback li { line-height:1.65; }
.field-ledger { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1px; margin:20px 0; background:var(--line); border:1px solid var(--line); }.field-ledger>div { padding:14px; background:#fff; }.field-ledger p { line-height:1.65; }.field-ledger small { color:var(--soft); }.deliverable-panel details { padding:16px; background:#fff; border:1px solid var(--line); }.deliverable-panel summary { font-weight:800; cursor:pointer; }.deliverable-panel pre { padding:14px; white-space:pre-wrap; background:#eef3f4; overflow-wrap:anywhere; }.deliverable-panel>textarea { margin-top:14px; }.counter { color:var(--soft); text-align:right; }.review-timeline { display:grid; gap:1px; margin-top:18px; background:var(--line); border:1px solid var(--line); }.review-timeline label { display:grid; grid-template-columns:20px 52px 1fr; gap:10px; align-items:start; padding:12px; background:#fff; line-height:1.6; }
.chapter-checkpoint { margin:36px 0 20px; padding:26px; background:#eef3f4; border:1px solid var(--line); border-radius:13px; }.checkpoint-heading { display:flex; justify-content:space-between; gap:18px; }.checkpoint-heading h3 { margin:6px 0 0; font-size:19px; }.reset-link { min-height:auto!important; padding:6px 8px!important; align-self:start; }.chapter-checkpoint fieldset { margin:22px 0; padding:0; border:0; }.chapter-checkpoint legend { margin-bottom:12px; font-weight:800; }.chapter-checkpoint fieldset label { display:flex; align-items:center; gap:9px; min-height:42px; margin-top:8px; padding:8px 10px; background:#fff; border:1px solid var(--line); }.chapter-checkpoint fieldset label span { font-weight:800; }.checkpoint-actions { display:flex; align-items:flex-start; gap:14px; }.checkpoint-actions p { margin:0; color:#ad3c35; line-height:1.65; }.checkpoint-actions p.passed { color:var(--green); }.retell-field { display:grid; gap:8px; margin-top:22px; }.retell-field>span { font-weight:800; line-height:1.6; }.retell-field small { color:var(--soft); line-height:1.6; }.checkpoint-footer { justify-content:space-between; }
.course-completion { margin:28px 0 12px; padding:24px; color:#fff; background:var(--navy); }.course-completion h3 { margin:0; font-size:22px; }.course-completion p { color:#d7e2e6; line-height:1.7; }.course-completion button.secondary { margin-left:8px; }
.route-column { min-width:0; padding:18px 14px 60px; background:var(--navy-2); }.route-panel { position:sticky; top:16px; overflow:visible; }.route-panel header { display:flex; justify-content:space-between; gap:12px; padding:8px 6px 16px; color:#fff; border-bottom:1px solid #214b5f; }.route-panel header div { display:grid; gap:4px; }.route-panel header em { color:#fff; font-style:normal; font-weight:800; }.route-panel ol { margin:0; padding:0; list-style:none; }.route-panel li { border-bottom:1px solid #214b5f; }.route-panel li button { display:grid; grid-template-columns:26px 1fr; gap:8px; width:100%; min-height:auto; padding:12px 6px; color:#a9c0c9; background:transparent; border:0; border-radius:0; text-align:left; }.route-panel li button>span { display:grid; place-items:center; width:24px; height:24px; border:1px solid #456779; }.route-panel li button strong { display:block; color:inherit; font-size:14px; line-height:1.45; }.route-panel li button small { display:block; margin-top:4px; color:#7fa0ae; font-size:12px; }.route-panel li button p { display:flex; gap:5px; margin:7px 0 0; }.route-panel li button i { padding:2px 4px; color:#7fa0ae; border:1px solid #285469; font-size:11px; font-style:normal; }.route-panel li button i.done { color:var(--navy); background:#fff; border-color:#fff; }.route-panel li button.current { color:var(--navy); background:#dfeaf0; }.route-panel li button.current small { color:#4b626d; }.route-panel li button.complete strong { color:#fff; }.route-panel li button.current.complete strong { color:var(--navy); }.route-note { padding:12px 6px; color:#a9c0c9; font-size:12px; line-height:1.6; }
.mobile-route { display:none; }.announcement { position:sticky; z-index:7; top:0; max-width:1160px; margin:0 auto; padding:11px 18px; color:#fff; background:var(--green); }
@media (max-width:1024px) { .course-layout { grid-template-columns:minmax(0,1fr) 210px; }.manuscript { padding-inline:34px; }.route-column { padding-inline:9px; }.cover-grid { grid-template-columns:1fr; }.cover-grid>div { grid-template-columns:120px 1fr 1fr; align-items:center; } }
@media (max-width:860px) { .course-layout { display:block; }.route-column { display:none; }.mobile-route { position:sticky; z-index:8; top:0; display:block; margin:0; color:#fff; background:var(--navy-2); }.mobile-route summary { min-height:46px; padding:12px 16px; border-bottom:1px solid #214b5f; font-weight:800; cursor:pointer; }.mobile-route nav { max-height:calc(100vh - 52px); padding:8px; overflow-y:auto; }.mobile-route button { display:grid; grid-template-columns:28px 1fr auto; align-items:center; gap:8px; width:100%; min-height:44px; margin-bottom:4px; padding:8px; color:#d7e2e6; background:transparent; border:1px solid #214b5f; text-align:left; }.mobile-route button em { font-style:normal; }.mobile-route button small { color:#a9c0c9; }.mobile-route button.current { color:var(--navy); background:#dfeaf0; }.mobile-route button.current small { color:var(--soft); }.announcement { top:46px; }.framework-chapter { scroll-margin-top:58px; } }
@media (max-width:600px) { .course-cover { padding:30px 18px; }.course-cover h1 { font-size:34px; }.cover-grid>div { grid-template-columns:1fr; }.manuscript { padding:0 16px 62px; }.framework-chapter { padding-top:42px; }.chapter-head { display:block; }.chapter-head>strong { display:inline-block; margin-top:12px; }.scenario-copy,.prerequisite-panel,.lab-panel,.independent-panel,.practice-workshop,.deliverable-panel,.memory-panel,.chapter-checkpoint { padding:18px; }.scenario-copy p,.objective-list li,.concept-why,.example-pair,.boundary-table dl>div,.record-grid,.field-ledger,.request-controls,.message-ledger,.response-result,.exchange-history li { grid-template-columns:1fr; }.scenario-copy blockquote { margin-inline:0; }.concept-ledger header,.lab-title,.checkpoint-heading { display:block; }.concept-ledger header>span { display:block; margin-top:8px; text-align:left; }.concept-ledger dl { grid-template-columns:1fr; }.relationship-map { padding:16px; overflow-x:auto; }.relationship-map>ol { grid-template-columns:repeat(3,220px); }.relationship-map>ul li { min-width:580px; }.checkpoint-actions,.checkpoint-footer,.panel-actions,.template-actions,.console-actions { align-items:stretch; flex-direction:column; }.checkpoint-actions button,.checkpoint-footer button,.panel-actions button,.template-actions button,.console-actions button { width:100%; }.course-completion button.secondary { margin:8px 0 0; }.review-timeline label { grid-template-columns:20px 46px 1fr; } }
@media (prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; transition:none!important; } }

/* Formal Day 01 shell contract: the application canvas is the only vertical
   scroll surface; desktop keeps both navigation rails and mobile keeps the
   approved 390 px lesson window with a sticky in-flow chapter directory. */
.day01-course {
  --w1-paper:#f5f6f8;
  --w1-paper-deep:#eff1f4;
  --w1-surface:#fff;
  --w1-ink:#20242a;
  --w1-ink-soft:#606772;
  --w1-ink-faint:#858b95;
  --w1-line:#e3e5e9;
  --w1-line-strong:#cfd2d8;
  position:relative;
  box-sizing:border-box;
  width:100%;
  min-height:100dvh;
  padding-left:224px;
  color:var(--w1-ink);
  background:#05283a;
  font-size:16px;
  line-height:1.7;
  overflow:visible;
}
.day01-course * { box-sizing:border-box; }
.w1-global-sidebar {
  position:fixed;
  z-index:60;
  inset:0 auto 0 0;
  width:224px;
  height:100dvh;
  display:flex;
  flex-direction:column;
  padding:22px 16px 18px;
  color:#eaf1f3;
  background:#09293d;
  box-shadow:12px 0 32px rgba(0,0,0,.14);
}
.w1-global-brand {
  display:flex;
  align-items:center;
  gap:11px;
  width:100%;
  min-height:0!important;
  padding:3px 5px 22px!important;
  color:inherit!important;
  background:transparent!important;
  border:0!important;
  border-radius:0!important;
  text-align:left;
}
.w1-global-brand svg { flex:0 0 auto; width:36px; height:36px; color:#ff9360; }
.w1-global-brand span { display:grid; line-height:1.05; }
.w1-global-brand strong { font-size:19px; font-weight:780; letter-spacing:.02em; }
.w1-global-brand small { margin-top:5px; color:#a9bec8; font-size:15px; letter-spacing:.28em; }
.w1-global-nav { display:grid; gap:5px; }
.w1-global-nav button {
  position:relative;
  display:grid;
  grid-template-columns:24px 1fr;
  align-items:center;
  gap:12px;
  min-height:47px;
  padding:0 12px;
  color:#abc0ca;
  background:transparent;
  border:0;
  border-radius:10px;
  text-align:left;
}
.w1-global-nav button:hover { color:#f5f8f9; background:rgba(255,255,255,.065); }
.w1-global-nav button.is-current { color:#fff; background:#16435d; }
.w1-global-nav button.is-current::before { content:""; position:absolute; left:-16px; width:3px; height:24px; background:#e66a2c; }
.w1-global-nav svg,.w1-archive-action svg { width:22px; height:22px; }
.w1-global-nav span { font-size:15px; font-weight:600; letter-spacing:.08em; }
.w1-global-footer { margin-top:auto; padding-top:22px; border-top:1px solid rgba(220,234,240,.13); }
.w1-weight-key { display:grid; gap:9px; padding:0 10px 18px; }
.w1-weight-key span { display:flex; align-items:center; gap:9px; color:#93abb6; font-size:15px; }
.w1-weight-key i { width:18px; height:3px; background:#6da4bd; }
.w1-weight-key span:nth-child(2) i { background:#e66a2c; }
.w1-weight-key span:nth-child(3) i { background:#be8e77; }
.w1-archive-action { display:flex; align-items:center; gap:10px; width:100%; min-height:0!important; padding:10px!important; color:#b5c7ce!important; background:transparent!important; border:0!important; text-align:left; font-size:15px; }
.w1-window { width:100%; min-height:100dvh; overflow:visible; background:#05283a; border:1px solid var(--w1-line); }
.w1-appbar { display:none; }
.w1-brand { display:flex; align-items:center; gap:10px; min-height:0!important; padding:0!important; color:inherit!important; background:transparent!important; border:0!important; }
.w1-brand-mark { display:grid; place-items:center; width:30px; height:30px; color:#fff; background:var(--orange); border-radius:9px; }
.w1-brand strong { font-size:14px; font-weight:600; }
.w1-appbar-meta { color:#a9c0c9; font-size:12px; }
.w1-shell { display:grid; grid-template-columns:minmax(0,1fr) 244px; align-items:stretch; background:#05283a; }
.w1-main { min-width:0; overflow:visible; background:var(--w1-surface); }
.course-cover {
  display:grid;
  grid-template-columns:minmax(0,1fr) 260px;
  gap:36px;
  padding:38px 40px 34px;
  color:var(--w1-ink);
  background:var(--w1-surface);
  border-bottom:1px solid var(--w1-line);
}
.eyebrow { margin:0 0 10px; color:var(--w1-ink-faint); font-size:15px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; }
.course-cover h1 { max-width:22ch; margin:0 0 12px; color:var(--w1-ink); font-size:clamp(28px,3.3vw,39px); line-height:1.18; font-weight:820; letter-spacing:-.03em; }
.subtitle { max-width:64ch; margin:0; color:var(--w1-ink-soft); font-size:16px; line-height:1.75; }
.cover-summary { align-self:stretch; padding:16px; color:var(--w1-ink); background:var(--w1-paper); border-radius:12px; }
.cover-summary-head,.cover-summary-labels { display:flex; justify-content:space-between; align-items:baseline; gap:12px; }
.cover-summary-head { margin-bottom:10px; }
.cover-summary-head strong { font-size:18px; }
.cover-summary-head span,.cover-summary-labels { color:var(--w1-ink-soft); font-size:12px; }
.cover-progress { height:7px; margin:0; background:var(--w1-line); border-radius:99px; }
.cover-progress i { background:var(--orange); }
.cover-summary-labels { margin-top:8px; }
.cover-evidence { display:flex; flex-wrap:wrap; gap:7px; margin-top:12px; }
.cover-evidence span { padding:3px 0; color:var(--w1-ink-soft); font-size:11px; }
.session-strip { display:grid; grid-template-columns:1fr 1fr; background:var(--w1-surface); border-bottom:1px solid var(--w1-line); }
.session-card { padding:18px 40px; }
.session-card + .session-card { border-left:1px solid var(--w1-line); }
.session-card strong { display:block; margin-bottom:4px; font-size:14px; font-weight:600; }
.session-card span { color:var(--w1-ink-soft); font-size:12px; line-height:1.5; }
.course-protocol { display:grid; grid-template-columns:132px minmax(0,1fr); gap:22px; padding:16px 40px; color:var(--w1-ink-soft); background:var(--w1-paper); border-bottom:1px solid var(--w1-line); }
.course-protocol span { color:#a94419; font-size:12px; font-weight:700; }
.course-protocol p { margin:0; font-size:13px; line-height:1.65; }
.announcement { position:relative; z-index:1; top:auto; max-width:none; margin:0; padding:11px 40px; }
.manuscript { min-width:0; padding:0 40px 48px; background:var(--w1-surface); }
.framework-chapter { width:100%; margin-inline:auto; padding:56px 0; scroll-margin-top:18px; border-bottom:1px solid var(--w1-line); overflow-wrap:anywhere; word-break:break-word; }
.chapter-head h2 { color:var(--w1-ink); font-size:clamp(23px,2.8vw,31px); font-weight:800; }
.chapter-head p { color:var(--w1-ink-soft); font-size:16px; }
.chapter-head>strong { min-width:70px; padding:6px 0; color:var(--w1-ink-faint); background:transparent; border:0; text-align:right; }
.w1-route {
  position:sticky;
  top:16px;
  align-self:start;
  min-width:0;
  max-height:none;
  padding:12px;
  color:#e7f0f3;
  background:#062f43;
  border-left:1px solid #214b5f;
  overflow:visible;
  overscroll-behavior:auto;
}
.w1-route-head { margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #214b5f; }
.w1-route-head strong { display:block; color:#e7f0f3; font-size:16px; }
.w1-route-head span { display:none; color:#a9c0c9; font-size:12px; }
.w1-route-group { margin-top:8px; }
.w1-route-group>strong { display:flex; justify-content:space-between; margin-bottom:5px; color:#e7f0f3; font-size:12px; letter-spacing:.06em; }
.w1-route-list { display:grid; gap:2px; }
.w1-route-item { display:block; width:100%; min-height:0!important; padding:5px 6px!important; color:#a9c0c9!important; background:transparent!important; border:1px solid transparent!important; border-radius:8px!important; text-align:left; }
.w1-route-item[aria-current="location"] { color:#05283a!important; background:#dce9ee!important; border-color:#87a7b5!important; }
.w1-route-title { display:grid; grid-template-columns:22px minmax(0,1fr); gap:6px 8px; font-size:13px; font-weight:650; line-height:1.35; }
.w1-route-states { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-top:3px; }
.w1-route-state { display:grid; place-items:center; min-height:22px; padding:3px 2px; color:#a9c0c9; background:transparent; border:1px solid transparent; border-radius:6px; font-size:12px; font-weight:520; line-height:1.35; }
.w1-route-state.is-done { color:#fff; background:rgba(255,255,255,.12); border-color:rgba(255,255,255,.2); font-weight:700; }
.w1-route-item[aria-current="location"] .w1-route-state { color:#426272; }
.w1-route-item[aria-current="location"] .w1-route-state.is-done { color:#05283a; background:#fff; border-color:#a9bec7; }
.w1-route-note { display:none; margin-top:18px; padding:11px; color:#a9c0c9; border-top:2px solid #ad3c35; font-size:11px; line-height:1.55; }
.w1-mobile-route { display:none; }

@media (max-width:1000px) {
  .day01-course:not([data-device="mobile"]) { padding-left:180px; }
  .day01-course:not([data-device="mobile"]) .w1-global-sidebar { width:180px; padding-inline:12px; }
  .day01-course:not([data-device="mobile"]) .w1-global-brand strong { font-size:17px; }
  .day01-course:not([data-device="mobile"]) .w1-shell { grid-template-columns:minmax(0,1fr) 188px; }
  .day01-course:not([data-device="mobile"]) .w1-route { padding:10px 8px; }
  .day01-course:not([data-device="mobile"]) .w1-route-item { padding:5px 4px!important; }
  .day01-course:not([data-device="mobile"]) .course-cover { gap:22px; padding:30px 28px 28px; }
  .day01-course:not([data-device="mobile"]) .session-card { padding:16px 28px; }
  .day01-course:not([data-device="mobile"]) .course-protocol,.day01-course:not([data-device="mobile"]) .manuscript { padding-inline:28px; }
}

.day01-course[data-device="mobile"] { min-height:0; padding-left:0; }
.day01-course[data-device="mobile"] .w1-global-sidebar { display:none; }
.day01-course[data-device="mobile"] .w1-window { width:min(390px,100%); min-height:780px; margin-inline:auto; overflow-x:clip; overflow-y:visible; border-radius:18px; box-shadow:none; }
.day01-course[data-device="mobile"] .w1-appbar { position:sticky; z-index:40; top:0; display:flex; align-items:center; justify-content:space-between; min-height:54px; padding:0 15px; color:#e7f0f3; background:#05283a; border-bottom:3px solid var(--orange); border-radius:18px 18px 0 0; }
.day01-course[data-device="mobile"] .w1-appbar-meta { display:none; }
.day01-course[data-device="mobile"] .w1-shell { display:block; }
.day01-course[data-device="mobile"] .w1-route { display:none; }
.day01-course[data-device="mobile"] .course-cover { grid-template-columns:1fr; gap:18px; padding:28px 20px 24px; }
.day01-course[data-device="mobile"] .course-cover h1 { font-size:30px; }
.day01-course[data-device="mobile"] .session-strip { grid-template-columns:1fr; }
.day01-course[data-device="mobile"] .session-card { padding:15px 20px; }
.day01-course[data-device="mobile"] .session-card+.session-card { border-left:0; border-top:1px solid var(--w1-line); }
.day01-course[data-device="mobile"] .w1-mobile-route { position:sticky; z-index:35; top:54px; display:block; padding:12px 16px; color:#e7f0f3; background:#062f43; border-bottom:1px solid #214b5f; }
.day01-course[data-device="mobile"] .w1-mobile-route summary { cursor:pointer; font-weight:650; line-height:1.55; }
.day01-course[data-device="mobile"] .w1-mobile-route .w1-route-list { max-height:none; margin-top:10px; padding:0; overflow:visible; }
.day01-course[data-device="mobile"] .w1-mobile-route .w1-route-item { padding:8px 7px!important; }
.day01-course[data-device="mobile"] .course-protocol { grid-template-columns:1fr; gap:5px; padding:14px 20px; }
.day01-course[data-device="mobile"] .announcement { padding-inline:20px; }
.day01-course[data-device="mobile"] .manuscript { padding:0 20px 32px; }
.day01-course[data-device="mobile"] .framework-chapter { padding-block:42px; scroll-margin-top:118px; }
.day01-course[data-device="mobile"] .scenario-copy p,
.day01-course[data-device="mobile"] .objective-list li,
.day01-course[data-device="mobile"] .concept-why,
.day01-course[data-device="mobile"] .example-pair,
.day01-course[data-device="mobile"] .boundary-table dl>div,
.day01-course[data-device="mobile"] .record-grid,
.day01-course[data-device="mobile"] .field-ledger,
.day01-course[data-device="mobile"] .request-controls,
.day01-course[data-device="mobile"] .message-ledger,
.day01-course[data-device="mobile"] .response-result,
.day01-course[data-device="mobile"] .exchange-history li { grid-template-columns:1fr; }
.day01-course[data-device="mobile"] .concept-ledger header,
.day01-course[data-device="mobile"] .lab-title,
.day01-course[data-device="mobile"] .checkpoint-heading { display:block; }
.day01-course[data-device="mobile"] .concept-ledger header>span { display:block; margin-top:8px; text-align:left; }
.day01-course[data-device="mobile"] .concept-ledger dl { grid-template-columns:1fr; }
.day01-course[data-device="mobile"] .relationship-map { min-width:0; padding:16px; overflow:visible; }
.day01-course[data-device="mobile"] .relationship-map>ol { grid-template-columns:1fr; overflow:visible; }
.day01-course[data-device="mobile"] .relationship-map>ul li { grid-template-columns:1fr; min-width:0; gap:4px; }
.day01-course[data-device="mobile"] .relationship-map>ul li i { display:none; }
.day01-course[data-device="mobile"] .checkpoint-actions,
.day01-course[data-device="mobile"] .checkpoint-footer,
.day01-course[data-device="mobile"] .panel-actions,
.day01-course[data-device="mobile"] .template-actions,
.day01-course[data-device="mobile"] .console-actions { align-items:stretch; flex-direction:column; }
.day01-course[data-device="mobile"] .checkpoint-actions button,
.day01-course[data-device="mobile"] .checkpoint-footer button,
.day01-course[data-device="mobile"] .panel-actions button,
.day01-course[data-device="mobile"] .template-actions button,
.day01-course[data-device="mobile"] .console-actions button { width:100%; }
.day01-course[data-device="mobile"] .chapter-head { display:block; }
.day01-course[data-device="mobile"] .chapter-head>strong { display:inline-block; margin-top:12px; text-align:left; }

@media (max-width:390px) {
  .day01-course[data-device="mobile"] .course-cover { padding-inline:16px; }
  .day01-course[data-device="mobile"] .course-cover h1 { font-size:28px; }
  .day01-course[data-device="mobile"] .session-card,.day01-course[data-device="mobile"] .course-protocol { padding-inline:16px; }
  .day01-course[data-device="mobile"] .manuscript { padding-inline:20px; }
}
</style>
