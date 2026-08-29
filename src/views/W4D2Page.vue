<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import W4D2Day01CourseView from '../components/W4D2Day01CourseView.vue'
import type { DailyLessonEvidenceState } from '../components/DailyLessonView.vue'
import { getDailyCourse } from '../course/registry'
import type { DayId, LessonSectionId } from '../course/types'
import {
  addAttempt,
  getDayProgress,
  loadEvidenceState,
  makeEvidenceId,
  markSectionVisited,
  saveDayDraft,
  saveEvidenceState,
  scheduleReviewTasks,
  setDayProgressStatus,
  type AttemptKind,
  type EvidenceState,
} from '../evidenceStore'

const props = defineProps<{ dayId: DayId; durationMode: 30 | 45 }>()
const emit = defineEmits<{
  back: []
  requestConfirmation: []
  navigate: [view: 'today' | 'course' | 'review' | 'progress' | 'glossary']
  'update:durationMode': [mode: 30 | 45]
  'evidence-change': [state: EvidenceState]
  'next-lesson-request': [payload: { from: string; to: string }]
}>()

const lesson = computed(() => getDailyCourse(props.dayId))
const evidenceLedger = ref(loadEvidenceState())
const draftState = ref<Partial<DailyLessonEvidenceState> | undefined>(readDraft())
let saveTimer: number | undefined
let pendingSectionId: LessonSectionId | undefined

function readDraft(): Partial<DailyLessonEvidenceState> | undefined {
  const raw = getDayProgress(evidenceLedger.value, props.dayId).drafts.dailyLessonEvidence
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<DailyLessonEvidenceState>
    return parsed.lessonId === props.dayId ? parsed : undefined
  } catch { return undefined }
}

function flushDraft() {
  const snapshot = draftState.value as DailyLessonEvidenceState | undefined
  if (!snapshot) return
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = undefined
  const now = new Date().toISOString()
  let next = saveDayDraft(evidenceLedger.value, props.dayId, 'dailyLessonEvidence', JSON.stringify(snapshot), now)
  if (pendingSectionId) next = markSectionVisited(next, props.dayId, pendingSectionId, now)
  pendingSectionId = undefined
  next = snapshot.completedAt ? setDayProgressStatus(next, props.dayId, 'completed', snapshot.completedAt) : setDayProgressStatus(next, props.dayId, 'in-progress', now)
  evidenceLedger.value = next
  saveEvidenceState(next)
  emit('evidence-change', next)
}

function persistDraft(snapshot: DailyLessonEvidenceState, sectionId?: LessonSectionId) {
  draftState.value = snapshot
  if (sectionId) pendingSectionId = sectionId
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(flushDraft, 120)
}

function conceptIdsForSection(sectionId: LessonSectionId): readonly string[] {
  if (!lesson.value) return []
  if (sectionId === 'guided-lab') return lesson.value.guidedLab.conceptIds
  if (sectionId === 'independent-lab') return lesson.value.independentLab.conceptIds
  if (sectionId === 'deliverable') return lesson.value.deliverable.conceptIds
  if (sectionId === 'memory') return lesson.value.memory.conceptIds
  if (sectionId === 'exercises' || sectionId === 'feedback') return lesson.value.exercises.flatMap((exercise) => exercise.conceptIds)
  return lesson.value.concepts.map((concept) => concept.id)
}

function attemptKindForSection(sectionId: LessonSectionId): AttemptKind | undefined {
  if (sectionId === 'guided-lab') return 'practical-operation'
  if (sectionId === 'independent-lab') return 'independent-variation'
  if (sectionId === 'deliverable') return 'work-product'
  if (sectionId === 'memory') return 'closed-book-explanation'
  if (sectionId === 'exercises' || sectionId === 'feedback') return 'targeted-practice'
  if (sectionId === 'concepts' || sectionId === 'diagram' || sectionId === 'demonstration') return 'reading'
  return undefined
}

function recordSectionAttempt(sectionId: LessonSectionId, snapshot: DailyLessonEvidenceState) {
  const kind = attemptKindForSection(sectionId)
  if (!kind || !lesson.value) return
  const now = new Date().toISOString()
  const verifiedBySystem = sectionId === 'guided-lab'
  const attempt = {
    id: makeEvidenceId(props.dayId, sectionId, snapshot.savedAt ?? now),
    dayId: props.dayId,
    activityId: `daily-${sectionId}`,
    conceptIds: conceptIdsForSection(sectionId),
    kind,
    attemptedAt: now,
    passed: true,
    verification: verifiedBySystem ? 'system' as const : 'self' as const,
    evidence: JSON.stringify(snapshot),
  }
  let next = addAttempt(evidenceLedger.value, attempt)
  if (verifiedBySystem) next = scheduleReviewTasks(next, { dayId: props.dayId, conceptIds: conceptIdsForSection(sectionId), learnedAt: now, sourceAttemptId: attempt.id })
  evidenceLedger.value = next
  saveEvidenceState(next)
  emit('evidence-change', next)
}

function onEvidenceChange(snapshot: DailyLessonEvidenceState) { persistDraft(snapshot) }
function onSaveAttempt(payload: { lessonId: string; sectionId: LessonSectionId; state: DailyLessonEvidenceState }) {
  if (payload.lessonId !== props.dayId) return
  persistDraft(payload.state, payload.sectionId)
  recordSectionAttempt(payload.sectionId, payload.state)
}
function onSectionComplete(payload: { lessonId: string; sectionId: LessonSectionId }) {
  if (payload.lessonId === props.dayId && draftState.value) persistDraft(draftState.value as DailyLessonEvidenceState, payload.sectionId)
}

onMounted(() => window.addEventListener('pagehide', flushDraft))
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', flushDraft)
  flushDraft()
})
</script>

<template>
  <div v-if="lesson" class="daily-course-page">
    <W4D2Day01CourseView
      :lesson="lesson"
      :duration-mode="durationMode"
      :evidence-state="draftState"
      @navigate="emit('navigate', $event)"
      @update:evidence-state="onEvidenceChange"
      @save-attempt="onSaveAttempt"
      @section-complete="onSectionComplete"
      @lesson-complete="onEvidenceChange($event.state)"
      @next-lesson-request="emit('next-lesson-request', $event)"
    />
  </div>
</template>

<style scoped>
.daily-course-page { min-height:100%; background:#05283a; }
</style>
