<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import DailyLessonView, { type DailyLessonEvidenceState } from '../components/DailyLessonView.vue'
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

const props = defineProps<{
  dayId: DayId
  durationMode: 30 | 45
}>()

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

function readDraft(): Partial<DailyLessonEvidenceState> | undefined {
  const raw = getDayProgress(evidenceLedger.value, props.dayId).drafts.dailyLessonEvidence
  if (!raw) return undefined
  try {
    const parsed = JSON.parse(raw) as Partial<DailyLessonEvidenceState>
    return parsed.lessonId === props.dayId ? parsed : undefined
  } catch {
    return undefined
  }
}

function persistDraft(snapshot: DailyLessonEvidenceState, sectionId?: LessonSectionId) {
  draftState.value = snapshot
  if (saveTimer) window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    const now = new Date().toISOString()
    let next = saveDayDraft(evidenceLedger.value, props.dayId, 'dailyLessonEvidence', JSON.stringify(snapshot), now)
    if (sectionId) next = markSectionVisited(next, props.dayId, sectionId, now)
    if (snapshot.completedAt) next = setDayProgressStatus(next, props.dayId, 'completed', snapshot.completedAt)
    else next = setDayProgressStatus(next, props.dayId, 'in-progress', now)
    evidenceLedger.value = next
    saveEvidenceState(next)
    emit('evidence-change', next)
  }, 120)
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
  if (verifiedBySystem) {
    next = scheduleReviewTasks(next, {
      dayId: props.dayId,
      conceptIds: conceptIdsForSection(sectionId),
      learnedAt: now,
      sourceAttemptId: attempt.id,
    })
  }
  evidenceLedger.value = next
  saveEvidenceState(next)
  emit('evidence-change', next)
}

function onEvidenceChange(snapshot: DailyLessonEvidenceState) {
  persistDraft(snapshot)
}

function onSaveAttempt(payload: { lessonId: string; sectionId: LessonSectionId; state: DailyLessonEvidenceState }) {
  if (payload.lessonId !== props.dayId) return
  persistDraft(payload.state, payload.sectionId)
  recordSectionAttempt(payload.sectionId, payload.state)
}

function onSectionComplete(payload: { lessonId: string; sectionId: LessonSectionId }) {
  if (payload.lessonId !== props.dayId) return
  if (draftState.value) persistDraft(draftState.value as DailyLessonEvidenceState, payload.sectionId)
}

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer)
})
</script>

<template>
  <div v-if="lesson" class="daily-course-page">
    <header class="daily-course-toolbar" aria-label="课程工具栏">
      <button type="button" class="course-back" @click="emit('back')">← 返回课程路线</button>
      <div class="duration-switch" role="group" aria-label="选择本次专注时长">
        <button type="button" :aria-pressed="durationMode === 30" @click="emit('update:durationMode', 30)">30 分钟核心</button>
        <button type="button" :aria-pressed="durationMode === 45" @click="emit('update:durationMode', 45)">45 分钟标准</button>
      </div>
    </header>

    <DailyLessonView
      :lesson="lesson"
      :duration-mode="durationMode"
      :evidence-state="draftState"
      @update:evidence-state="onEvidenceChange"
      @save-attempt="onSaveAttempt"
      @section-complete="onSectionComplete"
      @lesson-complete="onEvidenceChange($event.state)"
      @next-lesson-request="emit('next-lesson-request', $event)"
    />
  </div>
</template>

<style scoped>
.daily-course-page {
  min-height: 100%;
  padding: 16px 0 72px;
  background: var(--paper);
}

.daily-course-toolbar {
  width: min(1240px, 100%);
  min-height: 52px;
  margin: 0 auto 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.course-back,
.duration-switch button {
  min-height: 44px;
  color: var(--navy);
  background: rgba(255, 255, 255, .82);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-weight: 760;
}

.course-back {
  padding: 9px 14px;
}

.duration-switch {
  display: flex;
  gap: 8px;
}

.duration-switch button {
  padding: 9px 13px;
}

.duration-switch button[aria-pressed="true"] {
  color: #fff;
  background: var(--navy);
  border-color: var(--navy);
}

@media (max-width: 640px) {
  .daily-course-page {
    padding-top: 10px;
  }

  .daily-course-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
    padding-inline: 12px;
  }

  .duration-switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
