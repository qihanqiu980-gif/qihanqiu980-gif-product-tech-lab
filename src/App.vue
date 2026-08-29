<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { faultScenarios, glossary, quizQuestions, requestNodes, weeks } from './data'
import { weekGuides } from './weekGuides'
import { deepCurriculum } from './deepCurriculum'
import { evaluateSimulator, lessonFrameworks } from './lessonFramework'
import DailyCourseRouteView from './views/DailyCourseRouteView.vue'
import ReviewWorkbench from './components/ReviewWorkbench.vue'
import EvidenceAssessmentWorkbench from './components/EvidenceAssessmentWorkbench.vue'
import { parseHashRoute, writeHashRoute, type AppRoute } from './hashRouter'
import {
  deriveMasteryMap,
  getAssessmentQueue,
  getDayProgress,
  getDueReviewTasks,
  loadEvidenceState,
  saveEvidenceState,
  serializeEvidenceState,
  type EvidenceState,
} from './evidenceStore'
import { EXPECTED_DAY_IDS, getDailyCourseInventory, listDailyCourses, listRegisteredConcepts } from './course/registry.ts'
import { getDailyCourseRouteState } from './course/dayRouteState.ts'
import { w1d1 } from './course/w1d1.ts'
import type { DayId } from './course/types'
import {
  defaultState,
  downloadState,
  loadState,
  saveState,
  addDays,
  scheduleReviews,
  type LearningState,
  type ReviewRecord,
} from './storage'

const state = reactive<LearningState>(loadState())
const evidenceState = ref(loadEvidenceState())
const initialRoute = window.location.hash ? parseHashRoute() : null
const view = ref(initialRoute?.view || state.activeView)
const activeLesson = ref(initialRoute?.view === 'lesson' ? initialRoute.week : state.activeLesson)
const activeDayId = ref<DayId>(initialRoute?.view === 'day' ? initialRoute.dayId : 'W1D1')
const activeNode = ref(0)
const isTracing = ref(false)
const traceDone = ref(false)
const selectedFaultId = ref(faultScenarios[0].id)
const diagnosis = ref('')
const diagnosisFeedback = ref<'idle' | 'correct' | 'incorrect'>('idle')
const networkRows = ref<Array<{ name: string; method: string; code: number | string; time: string; size: string }>>([])
const quizFeedback = ref<'idle' | 'correct' | 'incorrect'>('idle')
const selectedQuizOption = ref<number | null>(null)
const glossaryQuery = ref('')
const importInput = ref<HTMLInputElement | null>(null)
const importMessage = ref('')
const bugMessage = ref('')
const workChainMessage = ref('')
const openMobileNav = ref(false)
const expandedWeek = ref(1)
const simulatorValues = reactive<Record<string, number>>({})
let traceTimer: number | undefined

const navItems = [
  { id: 'today', label: '今日', icon: 'today' },
  { id: 'course', label: '课程', icon: 'course' },
  { id: 'review', label: '复盘', icon: 'review' },
  { id: 'progress', label: '进度', icon: 'progress' },
  { id: 'glossary', label: '概念', icon: 'glossary' },
]

const dailyCourses = listDailyCourses()
const courseInventory = getDailyCourseInventory()
const courseDayStateById = new Map(EXPECTED_DAY_IDS.map((dayId) => [dayId, getDailyCourseRouteState(dayId)] as const))
const availableDayIds = EXPECTED_DAY_IDS.filter((dayId) => courseDayStateById.get(dayId)?.status === 'available')
const availableDayRange = availableDayIds.length > 1 ? `${availableDayIds[0]}–${availableDayIds.at(-1)}` : availableDayIds[0] ?? '暂无'
const availableCourseEntries = dailyCourses.filter((lesson) => courseDayStateById.get(lesson.id)?.status === 'available')
const catalogConceptEntries = listRegisteredConcepts()
const catalogConceptIds = catalogConceptEntries.map((entry) => entry.id)
const conceptLabelById = new Map(catalogConceptEntries.map((entry) => [entry.id, entry.concept.term] as const))

const todayISO = computed(() => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date()))

const activeWeek = computed(() => weeks.find((item) => item.id === activeLesson.value)!)
const activeGuide = computed(() => weekGuides[activeLesson.value])
const activeDeepFramework = computed(() => deepCurriculum[activeLesson.value])
const activeLessonFramework = computed(() => lessonFrameworks[activeLesson.value])
const labBase = document.querySelector<HTMLMetaElement>('meta[name="course-lab-base"]')?.content || './labs/'
const labPackUrl = computed(() => activeGuide.value
  ? new URL(activeGuide.value.labPack.path.replace(/^labs\//, ''), new URL(labBase, document.baseURI)).href
  : '')
const activeFault = computed(() => faultScenarios.find((item) => item.id === selectedFaultId.value)!)
const lessonQuestions = computed(() => quizQuestions.filter((item) => item.week === activeLesson.value))
const currentQuizIndex = computed(() => state.quizIndex[String(activeLesson.value)] || 0)
const currentQuestion = computed(() => lessonQuestions.value[currentQuizIndex.value % lessonQuestions.value.length])
const answeredQuestions = computed(() => Object.keys(state.quizAnswers).length)
const w1d1Mastery = computed(() => deriveMasteryMap(evidenceState.value, w1d1.concepts.map((concept) => concept.id)))
const catalogMastery = computed(() => deriveMasteryMap(evidenceState.value, catalogConceptIds))
const w1d1MasteredCount = computed(() => Object.values(w1d1Mastery.value).filter((item) => item.mastered).length)
const w1d1EvidenceCount = computed(() => new Set(Object.values(w1d1Mastery.value).flatMap((item) => item.evidenceAttemptIds)).size)
const dueReviews = computed(() => state.reviewRecords.filter((item) => !item.completedAt && item.dueAt <= todayISO.value))
const upcomingReviews = computed(() => state.reviewRecords.filter((item) => !item.completedAt && item.dueAt > todayISO.value).sort((a, b) => a.dueAt.localeCompare(b.dueAt)))
const v2DueReviews = computed(() => getDueReviewTasks(evidenceState.value, todayISO.value))
const assessmentQueue = computed(() => getAssessmentQueue(evidenceState.value))
const reviewNavCount = computed(() => v2DueReviews.value.length + assessmentQueue.value.length)
const conceptIndexEntries = computed(() => catalogConceptEntries.map((entry) => {
  const mastery = catalogMastery.value[entry.id]
  const mistakes = evidenceState.value.mistakes.filter((mistake) => mistake.conceptIds.includes(entry.id))
  const nextReview = evidenceState.value.reviewTasks
    .filter((task) => task.conceptId === entry.id && task.status !== 'completed')
    .slice()
    .sort((left, right) => left.dueOn.localeCompare(right.dueOn))[0]
  return { ...entry, mastery, mistakes, nextReview }
}))
const filteredConceptIndex = computed(() => {
  const query = glossaryQuery.value.trim().toLowerCase()
  if (!query) return conceptIndexEntries.value
  return conceptIndexEntries.value.filter((entry) => [
    entry.concept.term,
    entry.concept.english ?? '',
    entry.concept.definition,
    entry.concept.compareWith,
    entry.dayId,
    entry.dayTitle,
  ].some((text) => text.toLowerCase().includes(query)))
})
const w1d1Progress = computed(() => getDayProgress(evidenceState.value, w1d1.id))
const w1d1CompletedSections = computed(() => {
  const raw = w1d1Progress.value.drafts.dailyLessonEvidence
  if (!raw) return new Set<string>()
  try {
    const parsed = JSON.parse(raw) as { completedSections?: unknown }
    return new Set(Array.isArray(parsed.completedSections) ? parsed.completedSections.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set<string>()
  }
})
const todaySteps = computed(() => {
  const complete = w1d1CompletedSections.value
  const isDone = (ids: string[]) => ids.every((id) => complete.has(id))
  const coreMode = state.durationMode === 30
  return [
    { id: 'w1d1-scenario', label: '场景、目标与前置检查', meta: '先完成', done: isDone(['scenario', 'objectives', 'prerequisites']) },
    { id: 'w1d1-concepts', label: '12 个完整概念与关系图', meta: '必修 · 可分次', done: isDone(['concepts', 'diagram']) },
    { id: 'w1d1-demo', label: '11 步从头到尾的教师示范', meta: '完整证据链', done: isDone(['demonstration']) },
    { id: 'w1d1-labs', label: 'DOM / Console 引导实验与独立变式', meta: '本次优先实操', done: isDone(['guided-lab', 'independent-lab']) },
    { id: 'w1d1-proof', label: '练习、成果与闭卷复习', meta: coreMode ? '3 题 · 80 字实写' : '4 题 · 140 字实写', done: isDone(['exercises', 'deliverable', 'memory', 'completion']) },
  ]
})
const protocolStages = computed(() => ['工作场景', '概念讲解', '教师示范', '双重实验', '证据与复习'])
const todayDone = computed(() => todaySteps.value.filter((item) => item.done).length)
const todayPercent = computed(() => Math.round((todayDone.value / todaySteps.value.length) * 100))
const w1d1DueReviewCount = computed(() => getDueReviewTasks(evidenceState.value, todayISO.value).filter((item) => item.dayId === w1d1.id).length)
const capabilityScores = computed(() => ({
  explain: Math.round(Object.values(catalogMastery.value).filter((item) => item.passedKinds.includes('closed-book-explanation')).length / Math.max(1, catalogConceptIds.length) * 100),
  operate: Math.round(Object.values(catalogMastery.value).filter((item) => item.passedKinds.includes('practical-operation')).length / Math.max(1, catalogConceptIds.length) * 100),
  transfer: Math.round(Object.values(catalogMastery.value).filter((item) => item.passedKinds.includes('transfer')).length / Math.max(1, catalogConceptIds.length) * 100),
}))
const courseProgressRows = computed(() => dailyCourses.map((lesson) => {
  const progress = getDayProgress(evidenceState.value, lesson.id)
  const concepts = lesson.concepts.map((concept) => catalogMastery.value[concept.id])
  return {
    lesson,
    progress,
    masteredCount: concepts.filter((summary) => summary?.mastered).length,
    verifiedEvidenceCount: new Set(concepts.flatMap((summary) => summary?.evidenceAttemptIds ?? [])).size,
  }
}))
const simulatorResult = computed(() => evaluateSimulator(activeLesson.value, simulatorValues))

watch(state, () => saveState(state), { deep: true })
watch(view, (value) => { state.activeView = value })
watch(activeLesson, (value) => { state.activeLesson = value })
watch(activeLesson, (value) => resetSimulator(value), { immediate: true })

function navigate(nextView: string) {
  view.value = nextView
  openMobileNav.value = false
  if (['today', 'course', 'review', 'progress', 'glossary'].includes(nextView)) {
    writeHashRoute({ view: nextView as 'today' | 'course' | 'review' | 'progress' | 'glossary' })
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openLesson(week: number) {
  activeLesson.value = week
  quizFeedback.value = 'idle'
  selectedQuizOption.value = null
  view.value = 'lesson'
  writeHashRoute({ view: 'lesson', week })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openDay(dayId: DayId) {
  activeDayId.value = dayId
  view.value = 'day'
  openMobileNav.value = false
  writeHashRoute({ view: 'day', dayId })
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openNextLesson(payload: { from: string; to: string }) {
  openDay(payload.to as DayId)
}

function weekDayId(weekId: number, lessonIndex: number): DayId {
  return `W${weekId}D${lessonIndex + 1}` as DayId
}

function isDayAvailable(dayId: DayId) {
  return courseDayStateById.get(dayId)?.status === 'available'
}

function weekHasAvailableDay(weekId: number) {
  return Array.from({ length: 6 }, (_, index) => isDayAvailable(weekDayId(weekId, index))).some(Boolean)
}

function applyRoute(route: AppRoute) {
  if (route.view === 'day') {
    activeDayId.value = route.dayId
    view.value = 'day'
  } else if (route.view === 'lesson') {
    activeLesson.value = route.week
    view.value = 'lesson'
  } else {
    view.value = route.view
  }
  openMobileNav.value = false
}

function resetSimulator(week = activeLesson.value) {
  Object.keys(simulatorValues).forEach((key) => delete simulatorValues[key])
  lessonFrameworks[week]?.simulator.controls.forEach((control) => {
    simulatorValues[control.key] = control.default
  })
}

function simulatorControlValue(key: string) {
  const control = activeLessonFramework.value?.simulator.controls.find((item) => item.key === key)
  const value = simulatorValues[key]
  if (!control) return String(value ?? '')
  if ((key === 'preAggregate' || key === 'idempotency' || key === 'strictMode' || key === 'duplicate') && control.max === 1) {
    return value ? '开启' : '关闭'
  }
  if (key === 'auth') return ['未登录', '无权限', '已授权'][value] || String(value)
  return `${value}${control.unit}`
}

function toggleWeekDetails(week: number) {
  expandedWeek.value = expandedWeek.value === week ? 0 : week
}

function lessonPracticeId(weekId: number, lessonIndex: number) {
  return `w${weekId}-lesson-${lessonIndex + 1}`
}

function assessLessonPractice(weekId: number, lessonIndex: number, result: 'forgot' | 'fuzzy' | 'mastered') {
  const id = lessonPracticeId(weekId, lessonIndex)
  state.practiceResults[id] = result
}

function completeStep(id: string) {
  if (!state.completedSteps.includes(id)) state.completedSteps.push(id)
}

function selectRequestNode(index: number) {
  if (isTracing.value) return
  activeNode.value = index
}

function traceRequest() {
  if (traceTimer) window.clearInterval(traceTimer)
  isTracing.value = true
  traceDone.value = false
  networkRows.value = [{ name: '/api/orders/preview', method: 'POST', code: 'Pending', time: '—', size: '—' }]
  activeNode.value = 0
  let index = 0
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const delay = reduceMotion ? 120 : 620
  traceTimer = window.setInterval(() => {
    index += 1
    if (index >= requestNodes.length) {
      window.clearInterval(traceTimer)
      isTracing.value = false
      traceDone.value = true
      networkRows.value = [{ name: '/api/orders/preview', method: 'POST', code: 200, time: '284 ms', size: '1.2 kB' }]
      completeStep('w1-chain')
      completeStep('w1-network')
      return
    }
    activeNode.value = index
  }, delay)
}

function injectFault() {
  diagnosis.value = ''
  diagnosisFeedback.value = 'idle'
  networkRows.value = [{
    name: activeFault.value.id === 'stale-cache' ? '/api/campaigns/autumn' : '/api/admin/export',
    method: activeFault.value.id === 'server-error' ? 'POST' : 'GET',
    code: activeFault.value.code,
    time: `${activeFault.value.latency} ms`,
    size: activeFault.value.code === 200 ? '2.8 kB' : '416 B',
  }]
}

function checkDiagnosis() {
  diagnosisFeedback.value = diagnosis.value === activeFault.value.layer ? 'correct' : 'incorrect'
  if (diagnosisFeedback.value === 'correct') completeStep(`fault-${activeFault.value.id}`)
}

function submitQuiz() {
  if (selectedQuizOption.value === null) return
  const question = currentQuestion.value
  state.quizAnswers[question.id] = selectedQuizOption.value
  const correct = selectedQuizOption.value === question.answer
  quizFeedback.value = correct ? 'correct' : 'incorrect'
  if (!correct && !state.wrongQuestionIds.includes(question.id)) state.wrongQuestionIds.push(question.id)
  if (correct) {
    state.wrongQuestionIds = state.wrongQuestionIds.filter((id) => id !== question.id)
  }
  markConceptLearned(question.conceptId)
  completeStep(`w${activeLesson.value}-quiz`)
}

function syncEvidenceState(next: EvidenceState) {
  evidenceState.value = next
  saveEvidenceState(next)
}

function downloadEvidenceLedger() {
  const payload = {
    archiveVersion: 1,
    exportedAt: new Date().toISOString(),
    evidenceState: JSON.parse(serializeEvidenceState(evidenceState.value)),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `产品技术实验室-v2-证据账本-${todayISO.value}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function handleStorageSync(event: StorageEvent) {
  if (event.key === 'pm-tech-lab-evidence-state-v2') evidenceState.value = loadEvidenceState()
}

function nextQuestion() {
  state.quizIndex[String(activeLesson.value)] = (currentQuizIndex.value + 1) % lessonQuestions.value.length
  selectedQuizOption.value = null
  quizFeedback.value = 'idle'
}

function markConceptLearned(conceptId: string) {
  if (!state.learnedAt[conceptId]) {
    state.learnedAt[conceptId] = todayISO.value
    const existing = new Set(state.reviewRecords.map((item) => `${item.conceptId}-${item.stage}`))
    scheduleReviews(conceptId, todayISO.value).forEach((record) => {
      if (!existing.has(`${record.conceptId}-${record.stage}`)) state.reviewRecords.push(record)
    })
  }
}

function submitBugReport() {
  const required = ['title', 'environment', 'time', 'steps', 'expected', 'actual', 'evidence']
  const missing = required.filter((key) => !state.bugDraft[key]?.trim())
  if (missing.length) {
    bugMessage.value = `还缺 ${missing.length} 项关键信息。请补全环境、步骤、预期、实际和证据。`
    return
  }
  bugMessage.value = '结构完整。下一步请检查标题是否描述了“场景＋现象”，证据中是否包含准确时间或请求 ID。'
  completeStep('bug-report')
  markConceptLearned('log')
}

function completeReview(record: ReviewRecord, result: 'forgot' | 'fuzzy' | 'mastered') {
  record.completedAt = todayISO.value
  record.result = result
  if (result !== 'mastered') {
    const next = state.reviewRecords
      .filter((item) => item.conceptId === record.conceptId && !item.completedAt && item !== record)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]
    if (next) next.dueAt = addDays(todayISO.value, result === 'forgot' ? 1 : 3)
  }
}

function createDemoReviewQueue() {
  const concepts = activeWeek.value.concepts
  concepts.forEach(markConceptLearned)
  navigate('review')
}

function saveWorkChain() {
  const required = ['workFeature', 'workTrigger', 'workApi', 'workRule', 'workData', 'workResult']
  const missing = required.filter((key) => !state.notes[key]?.trim())
  if (missing.length) {
    workChainMessage.value = `还缺 ${missing.length} 个环节。先把触发、接口、规则、数据和反馈都补齐。`
    return
  }
  state.notes.workTransfer = `W1:${state.notes.workFeature}`
  completeStep('w1-output')
  workChainMessage.value = '链路图已保存到学习档案。现在尝试向研发确认其中一个你不确定的环节。'
}

function exportCalendar() {
  const reviews = state.reviewRecords.filter((item) => !item.completedAt).slice(0, 60)
  if (!reviews.length) return
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//产品技术实验室//复习计划//ZH-CN', 'CALSCALE:GREGORIAN']
  reviews.forEach((record) => {
    const concept = glossary.find((item) => item.id === record.conceptId)
    const date = record.dueAt.replaceAll('-', '')
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${record.conceptId}-${record.stage}@pm-tech-lab`)
    lines.push(`DTSTART;VALUE=DATE:${date}`)
    lines.push(`SUMMARY:${record.stage} 复习：${concept?.term || record.conceptId}`)
    lines.push(`DESCRIPTION:先闭卷解释，再完成一个产品场景或微操作。`)
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = '产品技术实验室-复习日历.ics'
  anchor.click()
  URL.revokeObjectURL(url)
}

async function importArchive(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text()) as LearningState
    if (parsed.version !== 1) throw new Error('version')
    Object.keys(state).forEach((key) => delete (state as unknown as Record<string, unknown>)[key])
    Object.assign(state, parsed)
    view.value = state.activeView
    activeLesson.value = state.activeLesson
    importMessage.value = '学习档案已恢复。'
  } catch {
    importMessage.value = '无法读取该文件，请选择由本课程导出的 JSON 学习档案。'
  } finally {
    input.value = ''
  }
}

function resetProgress() {
  if (!window.confirm('确定清空本机的 v1 旧课程历史进度、答案和笔记吗？这不会清空 W1D1 v2，但 v1 操作不可撤销。')) return
  Object.keys(state).forEach((key) => delete (state as unknown as Record<string, unknown>)[key])
  Object.assign(state, structuredClone(defaultState))
  view.value = 'today'
  activeLesson.value = 1
}

onBeforeUnmount(() => {
  if (traceTimer) window.clearInterval(traceTimer)
  window.removeEventListener('hashchange', handleHashChange)
  window.removeEventListener('storage', handleStorageSync)
})

function handleHashChange() {
  applyRoute(parseHashRoute())
}

onMounted(() => {
  window.addEventListener('hashchange', handleHashChange)
  window.addEventListener('storage', handleStorageSync)
  if (!window.location.hash) {
    const route: AppRoute = view.value === 'lesson'
      ? { view: 'lesson', week: activeLesson.value }
      : view.value === 'day'
        ? { view: 'day', dayId: activeDayId.value }
        : { view: (['today', 'course', 'review', 'progress', 'glossary'].includes(view.value) ? view.value : 'today') as 'today' | 'course' | 'review' | 'progress' | 'glossary' }
    writeHashRoute(route, true)
  }
})

nextTick(() => {
  if (!networkRows.value.length) {
    networkRows.value = [{ name: '/api/learning/today', method: 'GET', code: 200, time: '42 ms', size: '3.1 kB' }]
  }
})
</script>

<template>
  <div class="app-shell" :class="{ 'day-active': view === 'day', 'daily-course-active': view === 'day' && activeDayId !== 'W1D1' }">
    <aside class="side-rail" :class="{ open: openMobileNav }">
      <button class="brand" type="button" aria-label="返回今日学习" @click="navigate('today')">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7.5h9v9H5zM18 7.5h9M18 12h9M18 16.5h6M5 20.5h22M5 25h15" /></svg>
        <span><strong>产品技术</strong><small>实验室</small></span>
      </button>

      <nav aria-label="主要导航">
        <button
          v-for="item in navItems"
          :key="item.id"
          type="button"
          :class="{ active: view === item.id || (view === 'day' && item.id === 'course') }"
          @click="navigate(item.id)"
        >
          <svg v-if="item.icon === 'today'" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v14H4zM8 3.5v4M16 3.5v4M4 9.5h16M8 13h3M8 16h6" /></svg>
          <svg v-else-if="item.icon === 'course'" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h5M11 12h5" /></svg>
          <svg v-else-if="item.icon === 'review'" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8a8 8 0 1 1-1 7M5 8V3M5 8h5M12 7v5l3 2" /></svg>
          <svg v-else-if="item.icon === 'progress'" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7M3 19.5h18" /></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3zM8 4.5v15M11 9h4M11 12h3" /></svg>
          <span>{{ item.label }}</span>
          <span v-if="item.id === 'review' && reviewNavCount" class="nav-count">{{ reviewNavCount }}</span>
        </button>
      </nav>

      <div class="rail-foot">
        <div class="weight-key" aria-label="学习能力权重">
          <span><i class="data"></i>数据 40%</span>
          <span><i class="communication"></i>沟通 30%</span>
          <span><i class="review"></i>评审 30%</span>
        </div>
        <button class="icon-action" type="button" title="导出旧课程历史档案（不含 W1D1 v2）" @click="downloadState(state)">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 11l4 4 4-4M5 19h14" /></svg>
          <span>旧课档案</span>
        </button>
      </div>
    </aside>

    <header class="mobile-header">
      <button type="button" class="mobile-brand" @click="navigate('today')">产品技术实验室</button>
      <button type="button" class="menu-button" :aria-expanded="openMobileNav" aria-label="打开导航" @click="openMobileNav = !openMobileNav">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
    </header>

    <main class="main-canvas">
      <section v-if="view === 'today'" class="view today-view">
        <header class="view-heading today-heading">
          <div>
            <h1>今天，从浏览器与网页开始。</h1>
            <p>先完成已开放课程的概念、示范、实操、纠错和成果闭环；W1D1 建立页面基础，W1D2 与 W1D3 继续进入寻址和 HTTP。</p>
          </div>
          <div class="mode-switch" role="group" aria-label="选择今日学习时长">
            <button type="button" :aria-pressed="state.durationMode === 30" @click="state.durationMode = 30">30 分钟核心</button>
            <button type="button" :aria-pressed="state.durationMode === 45" @click="state.durationMode = 45">45 分钟标准</button>
          </div>
        </header>

        <div class="protocol-strip" aria-label="每日学习流程">
          <div v-for="(item, index) in protocolStages" :key="item" :class="{ current: index === todayDone, passed: index < todayDone }">
            <span>{{ index + 1 }}</span><strong>{{ item }}</strong>
          </div>
        </div>

        <section class="today-textbook" aria-labelledby="today-lesson-title">
          <div class="today-lesson-copy">
            <p class="today-course-code">W1D1 · 第 1 周第 1 天</p>
            <h2 id="today-lesson-title">浏览器、网页与前端：从一次点击读懂页面如何变化</h2>
            <p class="today-goal">今天的可验证目标：{{ w1d1.primaryGoal }}</p>
            <ul class="today-learning-points">
              <li><strong>先分清对象</strong><span>浏览器、网页、前端代码、DOM 与页面状态各自位于哪里。</span></li>
              <li><strong>再亲手操作</strong><span>修改 DOM、运行受限 Console、触发事件并记录前后证据。</span></li>
              <li><strong>最后守住边界</strong><span>页面显示成功不等于后端校验、正式发布或数据已经保存。</span></li>
            </ul>
            <p class="extension-note">完整首学的设计估算约 {{ w1d1.duration.full }} 分钟。30/45 分钟是单次专注时段，课程会自动保存；不会为了准点结束而跳过完整概念或示范。</p>
          </div>

          <aside class="today-protocol" aria-label="W1D1 今日进度">
            <div class="protocol-status">
              <div class="progress-number"><span>{{ todayDone }}</span>/{{ todaySteps.length }}</div>
              <div>
                <h2>{{ state.durationMode }} 分钟本次专注</h2>
                <p>{{ w1d1Progress.status === 'completed' ? '完整首学已完成；掌握仍看真实证据' : '完整课程可跨时段自动保存' }}</p>
              </div>
            </div>
            <div class="progress-track" aria-label="今日完成进度"><i :style="{ width: `${todayPercent}%` }"></i></div>
            <ol class="task-list">
              <li v-for="step in todaySteps" :key="step.id">
                <button type="button" @click="openDay('W1D1')">
                  <span class="check-box"><svg v-if="step.done" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg></span>
                  <span><strong>{{ step.label }}</strong><small>{{ step.meta }}</small></span>
                </button>
              </li>
            </ol>
            <button type="button" class="lesson-entry" @click="openDay('W1D1')">{{ w1d1Progress.status === 'not-started' ? '开始今天的 W1D1' : '继续上次学习' }} <span>→</span></button>
          </aside>
        </section>

        <div class="today-evidence-row">
          <section aria-labelledby="today-review-title">
            <h2 id="today-review-title">今天需要复习什么</h2>
            <p v-if="w1d1DueReviewCount">W1D1 有 <strong>{{ w1d1DueReviewCount }}</strong> 项到期复测。请到“复盘”中的真实复测执行台闭卷提交并逐项审核。</p>
            <p v-else>当前没有到期的 W1D1 复测。完成独立变式后，系统会安排 D1/D3/D7/D14/D30/D60。</p>
            <button type="button" class="text-action" @click="navigate('review')">进入复盘与证据审核</button>
          </section>
          <section aria-labelledby="today-mastery-title">
            <h2 id="today-mastery-title">当前真正掌握的能力</h2>
            <p><strong>{{ w1d1MasteredCount }}/{{ w1d1.concepts.length }}</strong> 个概念达到 L3；已记录 <strong>{{ w1d1EvidenceCount }}</strong> 条经系统、量规或他人验证的有效能力证据。</p>
            <button type="button" class="text-action" @click="navigate('progress')">查看证据规则与历史进度</button>
          </section>
        </div>

      </section>

      <section v-else-if="view === 'course'" class="view course-view">
        <header class="view-heading">
          <div><h1>12 周课程路线</h1><p>先看能力顺序与每日意图；只有完整教材、领域实验和证据适配都通过的 Day 才能进入学习。</p></div>
          <span class="date-anchor">2026.08.17 — 11.08</span>
        </header>

        <section class="course-status-note" aria-labelledby="course-status-title">
          <div>
            <h2 id="course-status-title">目前开放 {{ availableDayRange }}（{{ availableDayIds.length }}/{{ EXPECTED_DAY_IDS.length }}）</h2>
            <p>这里仅统计完整教材、专属 renderer、领域实验、schema v2 证据适配和人工审阅全部通过的 Day。已开放课程都可提前观看，不要求先完成前一天；其余 Day 保留路线位置，但在完整内容与专属实现通过前只显示开放条件。</p>
          </div>
          <button type="button" class="primary-action" @click="openDay('W1D1')">进入已开放课程</button>
        </section>

        <section class="available-day-strip" aria-labelledby="available-day-strip-title">
          <div>
            <h2 id="available-day-strip-title">已开放日课快速进入</h2>
            <p>入口来自正式 DailyCourse 与实现注册表；不读取前一天完成状态。W4D4 只交付上涨误导案例分析，下一步边界指向 W4D5 指标评审。</p>
          </div>
          <div class="available-day-list">
            <button v-for="lesson in availableCourseEntries" :key="lesson.id" type="button" @click="openDay(lesson.id)">
              <span>{{ lesson.id }}</span>
              <strong>{{ lesson.title }}</strong>
            </button>
          </div>
        </section>

        <section class="depth-framework" aria-labelledby="depth-framework-title">
          <div><h2 id="depth-framework-title">每周穿透四层，而不是只记术语</h2><p>先划清概念边界，再解释系统机制；随后用实验收集证据，最后处理失败、权衡与评审决策。</p></div>
          <ol>
            <li><span>理解</span><strong>概念与边界</strong><p>是什么、解决什么、由谁负责、不是什么。</p></li>
            <li><span>推演</span><strong>机制与链路</strong><p>输入如何经过规则、状态和依赖产生输出。</p></li>
            <li><span>实证</span><strong>证据与实验</strong><p>亲手操作，并说明证据的证明边界。</p></li>
            <li><span>决策</span><strong>失败与评审</strong><p>覆盖边界、异常、恢复、指标、风险与责任。</p></li>
          </ol>
        </section>

        <div class="phase-map" aria-label="五个学习阶段">
          <div><span>W1–2</span><strong>技术世界入门</strong><small>研发沟通</small></div>
          <i></i><div><span>W3–5</span><strong>SQL 与数据</strong><small>数据分析</small></div>
          <i></i><div><span>W6–7</span><strong>API 与评审</strong><small>需求评审</small></div>
          <i></i><div><span>W8–10</span><strong>Python 与实践</strong><small>数据分析</small></div>
          <i></i><div><span>W11–12</span><strong>AI 产品项目</strong><small>综合迁移</small></div>
        </div>

        <div class="week-ledger detailed-ledger">
          <article v-for="week in weeks" :key="week.id" :class="['week-module', { available: weekHasAvailableDay(week.id), expanded: expandedWeek === week.id }]">
            <button type="button" class="week-summary" :aria-expanded="expandedWeek === week.id" @click="toggleWeekDetails(week.id)">
              <div class="week-marker"><span>W{{ week.id }}</span><small>{{ week.dates }}</small></div>
              <div class="week-main"><div><h2>{{ week.title }}</h2><span :class="['weight-tag', week.weight]">{{ week.weight }}</span></div><p>{{ week.focus }}</p></div>
              <div class="week-result"><small>本周作品</small><strong>{{ week.output }}</strong></div>
              <span class="expand-indicator">{{ expandedWeek === week.id ? '收起' : '查看6课' }} <i aria-hidden="true"></i></span>
            </button>
            <div v-if="expandedWeek === week.id" class="week-expanded">
              <section class="week-outcomes"><h3>完成后你能做到</h3><ul><li v-for="outcome in week.outcomes" :key="outcome">{{ outcome }}</li></ul></section>
              <div class="lesson-sequence">
                <article v-for="(lesson, lessonIndex) in week.lessons" :key="lesson.day">
                  <div class="lesson-unit-head"><span>{{ weekDayId(week.id, lessonIndex) }}</span><b>{{ lesson.kind }}</b><em>{{ lesson.minutes }}分钟意图</em></div>
                  <h3>{{ lesson.title }}</h3><p>{{ lesson.detail }}</p><small>当日证据：{{ lesson.deliverable }} · 具体教学以完整 DailyCourse 为准</small>
                  <button type="button" :class="['day-baseline-entry', { pending: !isDayAvailable(weekDayId(week.id, lessonIndex)) }]" @click.stop="openDay(weekDayId(week.id, lessonIndex))">
                    {{ isDayAvailable(weekDayId(week.id, lessonIndex)) ? '打开完整日课 · 可提前观看' : '查看开放条件' }}
                  </button>
                </article>
              </div>
              <div class="week-practice-grid">
                <section><h3>周综合问题</h3><ol><li v-for="challenge in week.challenges" :key="challenge">{{ challenge }}</li></ol></section>
                <section><h3>周验收意图</h3><ul><li v-for="item in week.assessment" :key="item">{{ item }}</li></ul><p>具体量规将在对应 6 个 Day 完整制作后冻结。</p></section>
              </div>
              <div class="week-actions"><button type="button" class="secondary-action" @click="openDay(weekDayId(week.id, 0))">查看 W{{ week.id }}D1</button><span>未达质量门槛的 Day 会说明缺少什么，不会回退到旧周课。</span></div>
            </div>
          </article>
        </div>
      </section>

      <DailyCourseRouteView
        v-else-if="view === 'day'"
        :day-id="activeDayId"
        :duration-mode="state.durationMode"
        @update:duration-mode="state.durationMode = $event"
        @evidence-change="syncEvidenceState"
        @back="navigate('course')"
        @request-confirmation="navigate('course')"
        @navigate="navigate($event)"
        @next-lesson-request="openNextLesson($event)"
      />

      <section v-else-if="view === 'lesson'" class="view lesson-view">
        <button type="button" class="back-action" @click="navigate('course')">← 返回课程路线</button>
        <header class="lesson-header">
          <div class="lesson-code">W{{ activeWeek.id }} / {{ activeWeek.dates }}</div>
          <h1>{{ activeWeek.title }}</h1>
          <p>{{ activeWeek.focus }}。完成本课后，你将提交一份“{{ activeWeek.output }}”。</p>
          <div v-if="activeLesson <= 2" class="lesson-switch">
            <button type="button" :class="{ active: activeLesson === 1 }" @click="activeLesson = 1">W1 请求链路</button>
            <button type="button" :class="{ active: activeLesson === 2 }" @click="activeLesson = 2">W2 故障定位</button>
          </div>
        </header>

        <nav class="lesson-outline" aria-label="本周学习顺序">
          <a href="#lesson-why">为什么学</a>
          <a href="#lesson-relation">概念关系</a>
          <a href="#lesson-observer">交互观察</a>
          <a href="#lesson-case">产品案例</a>
          <a href="#lesson-lab">代码实验</a>
          <a href="#lesson-quiz">快速自测</a>
          <a href="#lesson-remember">记忆清单</a>
        </nav>

        <section id="lesson-why" class="lesson-block lesson-why">
          <div>
            <h2>为什么本周值得学</h2>
            <p>{{ activeLessonFramework.why }}</p>
          </div>
          <strong>{{ activeWeek.output }}</strong>
        </section>

        <section v-if="activeDeepFramework" id="lesson-relation" class="lesson-block deep-syllabus">
          <div class="block-title"><div><h2>本周要穿透的三个问题</h2><p>先带着问题学习。完成课程后，你应能用机制、证据和权衡回答，而不是只背名词。</p></div></div>
          <ol class="key-question-list"><li v-for="question in activeDeepFramework.keyQuestions" :key="question">{{ question }}</li></ol>
          <div class="depth-layer-grid">
            <article v-for="layer in activeDeepFramework.layers" :key="layer.name"><div><span>{{ layer.name }}</span><strong>{{ layer.objective }}</strong></div><ul><li v-for="topic in layer.topics" :key="topic">{{ topic }}</li></ul></article>
          </div>
          <details class="senior-extension"><summary>打开进阶任务与术语</summary><div><section><h3>进阶任务</h3><ol><li v-for="task in activeDeepFramework.seniorTasks" :key="task">{{ task }}</li></ol></section><section><h3>需要听懂的研发术语</h3><ul><li v-for="term in activeDeepFramework.terms" :key="term">{{ term }}</li></ul></section></div></details>
        </section>

        <section v-if="activeLesson >= 3" id="lesson-observer" class="lesson-block simulator-block">
          <div class="block-title"><div><h2>{{ activeLessonFramework.simulator.title }}</h2><p>{{ activeLessonFramework.simulator.purpose }} 拖动一个变量后，先描述变化，再判断它是否足以改变产品结论。</p></div><em class="simulated-label">教学模拟</em></div>
          <div class="simulator-layout">
            <div class="simulator-controls">
              <label v-for="control in activeLessonFramework.simulator.controls" :key="control.key">
                <span><strong>{{ control.label }}</strong><output :for="`sim-${control.key}`">{{ simulatorControlValue(control.key) }}</output></span>
                <input :id="`sim-${control.key}`" v-model.number="simulatorValues[control.key]" type="range" :min="control.min" :max="control.max" :step="control.step" />
                <small>{{ control.help }}</small>
              </label>
              <button type="button" class="text-action" @click="resetSimulator()">恢复默认实验条件</button>
            </div>
            <div class="simulator-output" aria-live="polite">
              <div class="simulator-metrics">
                <div v-for="metric in simulatorResult.metrics" :key="metric.label" :class="`tone-${metric.tone}`"><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
              </div>
              <div class="simulator-chart" role="img" :aria-label="`${activeLessonFramework.simulator.title}当前结果：${simulatorResult.evidence}`">
                <div v-for="bar in simulatorResult.chart" :key="bar.label">
                  <span>{{ bar.label }}</span><i><b :class="`tone-${bar.tone}`" :style="{ width: `${Math.min(100, Math.max(2, bar.value / Math.max(bar.max, 1) * 100))}%` }"></b></i><strong>{{ Math.round(bar.value) }}</strong>
                </div>
              </div>
              <div class="simulator-verdict"><span>当前判断</span><strong>{{ simulatorResult.verdict }}</strong><p>{{ simulatorResult.evidence }}</p></div>
            </div>
          </div>
        </section>

        <template v-if="activeLesson === 1">
          <section id="lesson-observer" class="lesson-block">
            <div class="block-title"><div><h2>一次请求的六个观察点</h2><p>点击节点，读懂职责与产品追问。</p></div></div>
            <div class="request-chain large">
              <button v-for="(node, index) in requestNodes" :key="node.id" type="button" :class="{ active: activeNode === index, passed: activeNode > index || traceDone }" @click="selectRequestNode(index)">
                <span class="node-index">{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ node.label }}</strong><small>{{ node.short }}</small>
              </button>
              <div class="signal-line" aria-hidden="true"><i :style="{ '--signal-step': activeNode }"></i></div>
            </div>
            <div class="lesson-node-detail">
              <div><span>职责</span><p>{{ requestNodes[activeNode].concept }}</p></div>
              <div><span>评审时追问</span><p>{{ requestNodes[activeNode].pm }}</p></div>
            </div>
          </section>

          <section id="lesson-case" class="lesson-block case-study">
            <div class="case-study-head"><h2>{{ activeLessonFramework.caseTitle }}</h2><span>产品工作场景（教学脱敏）</span></div>
            <div class="case-study-grid">
              <div><h3>背景</h3><p>{{ activeLessonFramework.caseContext }}</p></div>
              <div><h3>冲突</h3><p>{{ activeLessonFramework.caseConflict }}</p></div>
              <div><h3>必须收集的证据</h3><ul><li v-for="item in activeLessonFramework.caseEvidence" :key="item">{{ item }}</li></ul></div>
            </div>
          </section>

          <section id="lesson-lab" class="lesson-block lab-block">
            <div class="block-title"><div><h2>亲手追踪一次请求</h2><p>先预测，再运行，最后解释 Network 中的证据。以下接口、耗时和响应均为教学模拟。</p></div></div>
            <div class="lab-instruction">
              <ol>
                <li>预测：点击按钮后，哪一层负责最终判断优惠券能否使用？</li>
                <li>点击“运行请求”，观察信号依次经过哪些位置。</li>
                <li>查看状态码、耗时和返回大小。</li>
                <li>用自己的话回答：Pending 为什么不能直接说明数据库故障？</li>
              </ol>
              <button type="button" class="primary-action" :disabled="isTracing" @click="traceRequest">{{ isTracing ? '请求正在系统中移动…' : '运行请求' }}</button>
            </div>
            <div class="network-console">
              <div class="console-bar"><div><span class="record-dot"></span><strong>Network</strong><em class="simulated-label">教学模拟</em></div><span>{{ requestNodes[activeNode].label }} · {{ isTracing ? 'Pending' : traceDone ? 'Complete' : 'Idle' }}</span></div>
              <div class="network-table">
                <div class="network-row head"><span>Name</span><span>Method</span><span>Status</span><span>Time</span><span>Size</span></div>
                <div v-for="row in networkRows" :key="`${row.name}-${row.code}`" class="network-row"><span class="mono">{{ row.name }}</span><span>{{ row.method }}</span><span :class="['status-code', Number(row.code) >= 400 ? 'error' : row.code === 'Pending' ? 'pending' : 'success']">{{ row.code }}</span><span>{{ row.time }}</span><span>{{ row.size }}</span></div>
              </div>
              <div v-if="traceDone" class="console-result"><strong>观察结果：</strong>请求成功返回 200。耗时 284ms 表示从发送到接收完整响应的总时长，而不是数据库单独耗时。</div>
            </div>
          </section>

          <section v-if="state.durationMode === 45" class="lesson-block work-transfer">
            <div class="block-title"><div><h2>把你正在参与的一个功能画成链路</h2><p>45 分钟模式的进阶任务。只写脱敏信息；无法确认的环节可以写“待向研发确认”。</p></div></div>
            <div class="chain-builder">
              <label>功能名称<input v-model="state.notes.workFeature" placeholder="例：提交报销申请" /></label>
              <label>用户触发<input v-model="state.notes.workTrigger" placeholder="点击什么、前置条件是什么" /></label>
              <label>接口<input v-model="state.notes.workApi" placeholder="请求什么；不知道可写待确认" /></label>
              <label>后端规则<input v-model="state.notes.workRule" placeholder="权限、校验或状态变化" /></label>
              <label>数据读写<input v-model="state.notes.workData" placeholder="保存或查询什么数据" /></label>
              <label>页面反馈<input v-model="state.notes.workResult" placeholder="成功、失败、空状态如何表现" /></label>
            </div>
            <div class="chain-preview" aria-label="功能技术链路图预览">
              <span>{{ state.notes.workTrigger || '用户触发' }}</span><i>→</i><span>{{ state.notes.workApi || '接口' }}</span><i>→</i><span>{{ state.notes.workRule || '后端规则' }}</span><i>→</i><span>{{ state.notes.workData || '数据读写' }}</span><i>→</i><span>{{ state.notes.workResult || '页面反馈' }}</span>
            </div>
            <div class="form-actions"><button type="button" class="primary-action" @click="saveWorkChain">保存链路图</button><p v-if="workChainMessage">{{ workChainMessage }}</p></div>
          </section>
        </template>

        <template v-else-if="activeLesson === 2">
          <section id="lesson-observer" class="lesson-block fault-lab">
            <div class="block-title"><div><h2>同一个页面，四种完全不同的问题</h2><p>选择故障，运行请求，再根据教学模拟的状态码与日志定位。</p></div></div>
            <div class="fault-selector" role="group" aria-label="选择故障场景">
              <button v-for="fault in faultScenarios" :key="fault.id" type="button" :aria-pressed="selectedFaultId === fault.id" @click="selectedFaultId = fault.id; injectFault()">
                <span>{{ fault.code }}</span><strong>{{ fault.label }}</strong>
              </button>
            </div>
            <div class="fault-stage">
              <div class="fault-evidence">
                <span>页面现象</span><p>{{ activeFault.symptom }}</p>
                <span>教学模拟日志</span><code>{{ activeFault.log }}</code>
                <span>教学模拟 Network</span>
                <div class="mini-request"><b>{{ activeFault.code }}</b><i>{{ activeFault.latency }} ms</i><code>{{ activeFault.id }}</code></div>
              </div>
              <div class="diagnosis-panel">
                <label for="diagnosis">你认为主要问题在哪一层？</label>
                <select id="diagnosis" v-model="diagnosis">
                  <option value="">选择一个判断</option>
                  <option>前端</option><option>鉴权</option><option>权限</option><option>缓存</option><option>后端</option><option>数据库</option>
                </select>
                <button type="button" :disabled="!diagnosis" @click="checkDiagnosis">提交判断</button>
                <div v-if="diagnosisFeedback !== 'idle'" :class="['feedback', diagnosisFeedback]">
                  <strong>{{ diagnosisFeedback === 'correct' ? '定位正确' : '还不能由这些证据支持' }}</strong>
                  <p v-if="diagnosisFeedback === 'correct'">{{ activeFault.recovery }}</p>
                  <p v-else>重新比较状态码、页面是否拿到新数据，以及日志中的第一处明确线索。</p>
                </div>
              </div>
            </div>
          </section>

          <section id="lesson-case" class="lesson-block case-study">
            <div class="case-study-head"><h2>{{ activeLessonFramework.caseTitle }}</h2><span>产品工作场景（教学脱敏）</span></div>
            <div class="case-study-grid">
              <div><h3>背景</h3><p>{{ activeLessonFramework.caseContext }}</p></div>
              <div><h3>冲突</h3><p>{{ activeLessonFramework.caseConflict }}</p></div>
              <div><h3>必须收集的证据</h3><ul><li v-for="item in activeLessonFramework.caseEvidence" :key="item">{{ item }}</li></ul></div>
            </div>
          </section>

          <section id="lesson-lab" class="lesson-block bug-lab">
            <div class="block-title"><div><h2>写一份研发能立即使用的 Bug 报告</h2><p>系统只判断信息是否完整；表达质量仍需要你按量表自检。</p></div></div>
            <div class="bug-form">
              <label class="wide">标题<input v-model="state.bugDraft.title" placeholder="例：测试环境｜普通账号打开用户导出页返回403" /></label>
              <label>环境<input v-model="state.bugDraft.environment" placeholder="测试环境 / 版本号" /></label>
              <label>发生时间<input v-model="state.bugDraft.time" type="datetime-local" /></label>
              <label class="wide">复现步骤<textarea v-model="state.bugDraft.steps" rows="3" placeholder="1. 使用什么账号；2. 进入哪里；3. 执行什么操作"></textarea></label>
              <label>预期结果<textarea v-model="state.bugDraft.expected" rows="3" placeholder="系统应该怎样反馈"></textarea></label>
              <label>实际结果<textarea v-model="state.bugDraft.actual" rows="3" placeholder="实际看到了什么"></textarea></label>
              <label class="wide">证据<textarea v-model="state.bugDraft.evidence" rows="3" placeholder="状态码、错误码、请求ID、截图说明或日志关键词"></textarea></label>
            </div>
            <div class="rubric-line"><span>事实完整</span><span>逻辑成立</span><span>边界覆盖</span><span>表达可执行</span></div>
            <div class="form-actions"><button type="button" class="primary-action" @click="submitBugReport">检查报告</button><p v-if="bugMessage">{{ bugMessage }}</p></div>
          </section>
        </template>

        <template v-else-if="activeGuide">
          <section id="lesson-case" class="lesson-block case-study">
            <div class="case-study-head"><h2>{{ activeLessonFramework.caseTitle }}</h2><span>产品工作场景（教学脱敏）</span></div>
            <div class="case-study-grid">
              <div><h3>背景</h3><p>{{ activeLessonFramework.caseContext }}</p></div>
              <div><h3>冲突</h3><p>{{ activeLessonFramework.caseConflict }}</p></div>
              <div><h3>必须收集的证据</h3><ul><li v-for="item in activeLessonFramework.caseEvidence" :key="item">{{ item }}</li></ul></div>
            </div>
          </section>

          <section class="lesson-block concept-map-block">
            <div class="block-title"><div><h2>先建立本周因果链</h2><p>每个箭头都是你需要能向研发或数据同学解释的关系。</p></div></div>
            <div class="concept-map-line"><template v-for="(item, index) in activeGuide.conceptMap" :key="item"><span>{{ item }}</span><i v-if="index < activeGuide.conceptMap.length - 1" aria-hidden="true">→</i></template></div>
          </section>

          <section id="lesson-lab" class="lesson-block advanced-lab">
            <div class="block-title"><div><h2>{{ activeGuide.labTitle }}</h2><p>{{ activeGuide.labGoal }}</p></div></div>
            <div class="lab-pack-panel">
              <div>
                <h3>下载本周可运行资料</h3>
                <p>{{ activeGuide.labPack.runHint }}</p>
                <ul><li v-for="file in activeGuide.labPack.files" :key="file">{{ file }}</li></ul>
              </div>
              <a class="primary-action lab-download" :href="labPackUrl" download>下载 W{{ activeWeek.id }} 实验包 ZIP</a>
            </div>
            <div class="lab-guide-layout">
              <div class="lab-steps"><h3>6步实验</h3><ol><li v-for="step in activeGuide.steps" :key="step">{{ step }}</li></ol></div>
              <details class="starter-material"><summary>打开 {{ activeGuide.starterLabel }}</summary><pre><code>{{ activeGuide.starter }}</code></pre><p>先复制到本地测试环境再修改；不要直接连接生产数据或使用公司凭证。</p></details>
            </div>
            <div class="evidence-checklist"><h3>完成证据</h3><ul><li v-for="item in activeGuide.evidence" :key="item"><span aria-hidden="true"></span>{{ item }}</li></ul></div>
          </section>

          <section class="lesson-block mistake-workbench">
            <div class="block-title"><div><h2>常见错误：不只看答案，要说清错在哪里</h2><p>先闭卷解释错误的后果，再展开纠正原则。</p></div></div>
            <details v-for="item in activeGuide.commonMistakes" :key="item.mistake"><summary>{{ item.mistake }}</summary><p>{{ item.correction }}</p></details>
          </section>

          <section class="lesson-block deliverable-block">
            <div class="block-title"><div><h2>本周作品模板</h2><p>每一项都要有你亲手生成的证据，不能只复制示例。</p></div></div>
            <ol class="deliverable-template"><li v-for="item in activeGuide.deliverableTemplate" :key="item">{{ item }}</li></ol>
            <div class="lesson-sequence compact-sequence">
              <article v-for="(lesson, lessonIndex) in activeWeek.lessons" :key="lesson.day">
                <div class="lesson-unit-head"><span>{{ lesson.day }}</span><b>{{ lesson.kind }}</b><em>{{ lesson.minutes }}分钟</em></div><h3>{{ lesson.title }}</h3><p>{{ lesson.detail }}</p><small>当日证据：{{ lesson.deliverable }}</small>
                <details class="lesson-check"><summary>打开 5 层练习</summary><div class="layered-practice"><ol><li v-for="item in lesson.practice" :key="item.level"><b>{{ item.level }}</b><span>{{ item.prompt }}</span></li></ol><p>{{ lesson.rubric }}</p></div><div class="self-assessment"><button type="button" :class="{ selected: state.practiceResults[lessonPracticeId(activeWeek.id, lessonIndex)] === 'forgot' }" @click="assessLessonPractice(activeWeek.id, lessonIndex, 'forgot')">不会</button><button type="button" :class="{ selected: state.practiceResults[lessonPracticeId(activeWeek.id, lessonIndex)] === 'fuzzy' }" @click="assessLessonPractice(activeWeek.id, lessonIndex, 'fuzzy')">模糊</button><button type="button" :class="{ selected: state.practiceResults[lessonPracticeId(activeWeek.id, lessonIndex)] === 'mastered' }" @click="assessLessonPractice(activeWeek.id, lessonIndex, 'mastered')">自评：可独立完成</button></div></details>
              </article>
            </div>
          </section>
        </template>

        <section id="lesson-quiz" class="lesson-block quiz-block">
          <div class="block-title"><div><h2>本周快速自测</h2><p>每周 10 道即时题。一次只解决一个判断，提交后解释原因；答错内容进入同概念复训与间隔复习。</p></div></div>
          <div class="question-paper">
            <div class="question-meta"><span>第 {{ currentQuizIndex + 1 }} / {{ lessonQuestions.length }} 题</span><span>{{ currentQuestion.level }} · {{ glossary.find((item) => item.id === currentQuestion.conceptId)?.term }}</span></div>
            <h3>{{ currentQuestion.prompt }}</h3>
            <div class="option-list">
              <label v-for="(option, index) in currentQuestion.options" :key="option" :class="{ selected: selectedQuizOption === index, correct: quizFeedback !== 'idle' && index === currentQuestion.answer, wrong: quizFeedback === 'incorrect' && selectedQuizOption === index }">
                <input v-model="selectedQuizOption" type="radio" :value="index" :disabled="quizFeedback !== 'idle'" /><span>{{ String.fromCharCode(65 + index) }}</span><strong>{{ option }}</strong>
              </label>
            </div>
            <div v-if="quizFeedback !== 'idle'" :class="['feedback', quizFeedback]">
              <strong>{{ quizFeedback === 'correct' ? '判断正确' : '本题待巩固' }}</strong><p>{{ currentQuestion.explanation }}</p>
            </div>
            <div class="question-actions">
              <button v-if="quizFeedback === 'idle'" type="button" class="primary-action" :disabled="selectedQuizOption === null" @click="submitQuiz">提交答案</button>
              <button v-else type="button" class="primary-action" @click="nextQuestion">下一题</button>
              <button type="button" class="text-action" @click="createDemoReviewQueue">查看 D1 / D3 / D7 复习</button>
            </div>
          </div>
        </section>

        <section id="lesson-remember" class="lesson-block remember-block">
          <div class="block-title"><div><h2>本周只需要记住这些</h2><p>先闭卷复述，再展开查看。能够解释、操作并迁移后，才进入长期复习周期。</p></div></div>
          <ol><li v-for="item in activeLessonFramework.remember" :key="item">{{ item }}</li></ol>
          <div class="next-week"><span>下一步</span><p>{{ activeLessonFramework.next }}</p><button v-if="activeWeek.id < 12" type="button" class="secondary-action" @click="openLesson(activeWeek.id + 1)">进入 W{{ activeWeek.id + 1 }}</button><button v-else type="button" class="secondary-action" @click="navigate('progress')">查看能力进度</button></div>
        </section>
      </section>

      <section v-else-if="view === 'review'" class="view review-view">
        <header class="view-heading"><div><h1>复盘中心</h1><p>先闭卷回忆，再看答案。重读不算复习。</p></div><button type="button" class="secondary-action" :disabled="!state.reviewRecords.length" @click="exportCalendar">导出日历提醒</button></header>

        <EvidenceAssessmentWorkbench
          :evidence-state="evidenceState"
          @change="syncEvidenceState"
          @open-day="openDay"
        />

        <ReviewWorkbench
          :evidence-state="evidenceState"
          :today="todayISO"
          @change="syncEvidenceState"
          @open-day="openDay"
        />

        <p class="quiet-message">以下区域仅保留旧课程 v1 的历史复习记录。它的“不会／模糊／自评通过”不会提高 v2 能力等级；新的日课统一使用上方真实复测执行台。</p>

        <div v-if="!state.reviewRecords.length" class="empty-state">
          <svg viewBox="0 0 80 80" aria-hidden="true"><path d="M16 21h48v40H16zM25 13v16M55 13v16M16 33h48M27 45h11M27 53h25" /></svg>
          <h2>完成一次小测后，复习会自动出现</h2>
          <p>系统会为相关概念安排 D1、D3、D7、D14、D30 和 D60。</p>
          <button type="button" class="primary-action" @click="openLesson(1)">去完成 W1 小测</button>
        </div>

        <template v-else>
          <section v-if="state.wrongQuestionIds.length" class="wrong-question-workbench">
            <div><h2>错题复训</h2><p>不是重看答案：先说明上次为什么错，再在新场景中做一次同概念判断。</p></div>
            <ul><li v-for="questionId in state.wrongQuestionIds" :key="questionId"><strong>{{ quizQuestions.find((item) => item.id === questionId)?.prompt }}</strong><span>{{ quizQuestions.find((item) => item.id === questionId)?.level }} · 待同概念复测</span></li></ul>
            <button type="button" class="secondary-action" @click="openLesson(quizQuestions.find((item) => item.id === state.wrongQuestionIds[0])?.week || 1)">开始复训</button>
          </section>
          <section class="review-lane">
            <div class="lane-heading"><h2>今日到期</h2><span>{{ dueReviews.length }} 项</span></div>
            <div v-if="!dueReviews.length" class="quiet-message">今天没有逾期任务。下面可以预览接下来的复习节奏。</div>
            <article v-for="record in dueReviews" :key="`${record.conceptId}-${record.stage}`" class="review-item due">
              <div class="review-date"><strong>{{ record.stage }}</strong><small>{{ record.dueAt }}</small></div>
              <div><h3>{{ glossary.find((item) => item.id === record.conceptId)?.term }} <small>{{ glossary.find((item) => item.id === record.conceptId)?.english }}</small></h3><p>不看笔记：用一句话解释它，再举一个产品工作中的例子。</p></div>
              <div class="review-actions"><button type="button" @click="completeReview(record, 'forgot')">不会</button><button type="button" @click="completeReview(record, 'fuzzy')">模糊</button><button type="button" @click="completeReview(record, 'mastered')">自评通过</button></div>
            </article>
          </section>
          <section class="review-lane">
            <div class="lane-heading"><h2>接下来</h2><span>按间隔排列</span></div>
            <article v-for="record in upcomingReviews.slice(0, 15)" :key="`${record.conceptId}-${record.stage}`" class="review-item">
              <div class="review-date"><strong>{{ record.stage }}</strong><small>{{ record.dueAt }}</small></div>
              <div><h3>{{ glossary.find((item) => item.id === record.conceptId)?.term }}</h3><p>{{ record.stage === 'D1' ? '概念回忆＋微操作' : record.stage === 'D3' ? '易混概念＋混合题' : record.stage === 'D7' ? '产品业务场景题' : '迁移到新的工作场景' }}</p></div>
              <span class="mastery-label">L{{ state.mastery[record.conceptId] || 0 }}</span>
            </article>
          </section>
        </template>
      </section>

      <section v-else-if="view === 'progress'" class="view progress-view">
        <header class="view-heading"><div><h1>能力进度</h1><p>完成页面不等于掌握；这里只用权威日课注册表和 v2 真实证据计算能力。</p></div><button type="button" class="secondary-action" @click="downloadEvidenceLedger">导出 v2 证据账本</button></header>

        <section class="inventory-truth" aria-label="课程完成范围">
          <div><span>已达内容基准</span><strong>{{ courseInventory.available }}/{{ courseInventory.expected }} Days</strong></div>
          <p>当前只有已登记的完整日课进入掌握统计；缺失的 {{ courseInventory.missing.length }} Day 不会被旧提纲、周页面或自动练习冒充完成。</p>
        </section>

        <section class="capability-board">
          <article><div><span>已验证闭卷解释</span><strong>{{ capabilityScores.explain }}%</strong></div><p>不看笔记说清定义、边界和产品意义。</p><div class="capability-track"><i :style="{ width: `${capabilityScores.explain}%` }"></i></div></article>
          <article><div><span>已验证实操</span><strong>{{ capabilityScores.operate }}%</strong></div><p>由系统确认完成真实操作；阅读和勾选不计入。</p><div class="capability-track"><i :style="{ width: `${capabilityScores.operate}%` }"></i></div></article>
          <article><div><span>已验证迁移证据</span><strong>{{ capabilityScores.transfer }}%</strong></div><p>在不同场景中提交并通过迁移量规。</p><div class="capability-track"><i :style="{ width: `${capabilityScores.transfer}%` }"></i></div></article>
        </section>

        <section class="day-progress-board">
          <div class="matrix-heading"><h2>真实日课进度</h2><div><span>页面完成只表示首学流程</span><span>掌握单独计算</span></div></div>
          <article v-for="row in courseProgressRows" :key="row.lesson.id">
            <button type="button" @click="openDay(row.lesson.id)">
              <span>{{ row.lesson.id }}</span>
              <div><strong>{{ row.lesson.title }}</strong><small>{{ row.progress.status }} · {{ row.progress.visitedSections.length }} 节已记录</small></div>
              <div><strong>{{ row.masteredCount }}/{{ row.lesson.concepts.length }} L3</strong><small>{{ row.verifiedEvidenceCount }} 条有效证据</small></div>
            </button>
          </article>
        </section>

        <section class="mastery-matrix">
          <div class="matrix-heading"><h2>v2 概念掌握矩阵</h2><div><span>L0 无有效证据</span><span>L1 部分核心证据</span><span>L2 核心证据齐全</span><span>L3 长期保持＋迁移</span></div></div>
          <div class="matrix-grid">
            <div v-for="entry in conceptIndexEntries" :key="entry.id" class="matrix-row">
              <div><strong>{{ entry.concept.term }}</strong><small>{{ entry.dayId }} · {{ entry.concept.english }}</small></div>
              <div class="level-cells"><i v-for="level in [0, 1, 2, 3]" :key="level" :class="{ reached: entry.mastery.level >= level, current: entry.mastery.level === level }"></i></div>
              <span>L{{ entry.mastery.level }}</span>
            </div>
          </div>
        </section>

        <section class="archive-tools">
          <div><h2>旧课程历史档案</h2><p>旧 v1 点击、自评和周课记录继续保留，但不参与上方 v2 掌握矩阵。这里的操作不会导入或清空 v2 证据。</p></div>
          <div class="archive-actions"><button type="button" class="primary-action" @click="downloadState(state)">导出 v1 JSON</button><button type="button" class="secondary-action" @click="importInput?.click()">导入 v1 恢复</button><button type="button" class="danger-action" @click="resetProgress">清空 v1 历史</button><input ref="importInput" class="sr-only" type="file" accept="application/json" @change="importArchive" /></div>
          <p v-if="importMessage" class="import-message">{{ importMessage }}</p>
        </section>
      </section>

      <section v-else-if="view === 'glossary'" class="view glossary-view">
        <header class="view-heading"><div><h1>概念索引</h1><p>索引读取真实日课注册表，连接首次教学、实验、错题、掌握证据和下一次复习；它不代替正文中的首次教学。</p></div></header>
        <p class="quiet-message">当前索引只包含 {{ courseInventory.available }} 个已达基准的 Day；其余 {{ courseInventory.missing.length }} Day 在完整内容注册前不会显示为“已学概念”。</p>
        <label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg><span class="sr-only">搜索概念</span><input v-model="glossaryQuery" placeholder="搜索概念、定义、易混对象或首次学习 Day……" /></label>
        <div class="concept-index-list">
          <article v-for="entry in filteredConceptIndex" :key="entry.id" class="concept-index-card">
            <header>
              <div><span>{{ entry.dayId }} · 首次教学</span><h2>{{ entry.concept.term }} <small>{{ entry.concept.english }}</small></h2></div>
              <strong>L{{ entry.mastery.level }}</strong>
            </header>
            <p class="plain-definition">{{ entry.concept.definition }}</p>
            <dl>
              <div><dt>本课前置概念</dt><dd>{{ entry.prerequisiteConceptIds.length ? entry.prerequisiteConceptIds.map((id) => conceptLabelById.get(id) || id).join('、') : '课程起点，无技术概念前置' }}</dd></div>
              <div><dt>易混概念与边界</dt><dd>{{ entry.concept.compareWith }}</dd></div>
              <div><dt>对应示例</dt><dd>{{ entry.concept.correctExample }}</dd></div>
              <div><dt>本课实验</dt><dd>引导：{{ entry.guidedLabTitle }}；独立变式：{{ entry.independentLabTitle }}</dd></div>
              <div><dt>对应错题</dt><dd>{{ entry.mistakes.length ? `${entry.mistakes.filter((item) => item.status === 'open').length} 道待复测 / ${entry.mistakes.length} 道历史记录` : '暂无错题记录' }}</dd></div>
              <div><dt>当前掌握证据</dt><dd>{{ entry.mastery.reason }} 已通过：{{ entry.mastery.passedKinds.length ? entry.mastery.passedKinds.join('、') : '无' }}</dd></div>
              <div><dt>下一次复习</dt><dd>{{ entry.nextReview ? `${entry.nextReview.stage} · ${entry.nextReview.dueOn} · ${entry.nextReview.status}` : '尚未排程' }}</dd></div>
            </dl>
            <div class="concept-index-actions"><button type="button" class="secondary-action" @click="openDay(entry.dayId)">打开 {{ entry.dayId }} 正文</button><button type="button" class="text-action" @click="navigate('review')">查看证据与复习</button></div>
          </article>
        </div>
      </section>
    </main>

    <nav class="bottom-nav" aria-label="移动端导航">
      <button v-for="item in navItems" :key="item.id" type="button" :class="{ active: view === item.id || (view === 'day' && item.id === 'course') }" @click="navigate(item.id)"><span>{{ item.label }}</span><i v-if="item.id === 'review' && reviewNavCount">{{ reviewNavCount }}</i></button>
    </nav>
  </div>
</template>
