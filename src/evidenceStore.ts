import type { DayId } from './course/types'

/**
 * Evidence ledger v2 deliberately uses a different key from storage.ts.
 * The v1 learning state and this append-only evidence ledger can therefore
 * coexist without either store migrating or overwriting the other.
 */
export const EVIDENCE_STORAGE_KEY = 'pm-tech-lab-evidence-state-v2' as const

export const REVIEW_SCHEDULE = [
  { stage: 'D1', days: 1 },
  { stage: 'D3', days: 3 },
  { stage: 'D7', days: 7 },
  { stage: 'D14', days: 14 },
  { stage: 'D30', days: 30 },
  { stage: 'D60', days: 60 },
] as const

export type ReviewStage = (typeof REVIEW_SCHEDULE)[number]['stage']

/** Evidence that may be recorded by a lesson. Only the first six kinds can
 * contribute to mastery; reading, self-assessment and a single practice item
 * are useful activity records but are never mastery evidence. */
export type AttemptKind =
  | 'closed-book-explanation'
  | 'practical-operation'
  | 'independent-variation'
  | 'work-product'
  | 'spaced-retest'
  | 'transfer'
  | 'targeted-practice'
  | 'reading'
  | 'self-assessment'

export type VerificationMethod = 'system' | 'rubric' | 'reviewer' | 'self'

export type AssessmentMethod = 'rubric' | 'reviewer'
export type AssessorRole = 'learner-with-rubric' | 'peer' | 'mentor' | 'instructor'

export interface AssessmentCriterionScore {
  readonly criterionId: string
  readonly score: number
  readonly maximumScore: number
  readonly feedback?: string
}

/**
 * An assessment never rewrites the learner submission. It appends an auditable
 * verdict that references an immutable attempt. A later assessment may
 * supersede an earlier verdict while preserving the full review history.
 */
export interface AssessmentRecord {
  readonly id: string
  readonly attemptId: string
  readonly method: AssessmentMethod
  readonly assessorRole: AssessorRole
  readonly rubricId: string
  readonly rubricVersion: string
  readonly criteria: readonly AssessmentCriterionScore[]
  readonly score: number
  readonly passed: boolean
  readonly reviewedAt: string
  readonly feedback: string
  readonly supersedesId?: string
  readonly voided?: boolean
}

export interface AttemptRecord {
  readonly id: string
  readonly dayId: DayId
  readonly activityId: string
  readonly conceptIds: readonly string[]
  readonly kind: AttemptKind
  readonly attemptedAt: string
  readonly passed: boolean
  /** Percentage score. Work products require a score of at least 80. */
  readonly score?: number
  readonly verification: VerificationMethod
  readonly evidence?: string
  readonly feedback?: string
  readonly reviewStage?: ReviewStage
  readonly reviewTaskId?: string
  /** Required for transfer evidence so a reviewer can verify real novelty. */
  readonly transferContext?: {
    readonly sourceScenarioId: string
    readonly scenarioId: string
    readonly changedDimensions: readonly string[]
  }
}

export interface MistakeRetest {
  readonly attemptId: string
  readonly attemptedAt: string
  readonly passed: boolean
}

export interface RemediationLocation {
  readonly dayId: DayId
  readonly sectionId: string
  readonly anchor?: string
}

export interface MistakeRecord {
  readonly id: string
  readonly dayId: DayId
  readonly questionId: string
  readonly originalQuestion: string
  readonly userAnswer: string
  readonly correctAnswer: string
  readonly errorReason: string
  readonly conceptIds: readonly string[]
  readonly remediation: RemediationLocation
  readonly sourceAttemptId?: string
  readonly createdAt: string
  readonly status: 'open' | 'resolved'
  readonly nextRetestOn?: string
  readonly retests: readonly MistakeRetest[]
  readonly resolvedAt?: string
  readonly resolutionAttemptId?: string
}

export interface ReviewTask {
  readonly id: string
  readonly dayId: DayId
  readonly conceptId: string
  readonly stage: ReviewStage
  readonly dueOn: string
  readonly sourceAttemptId?: string
  readonly status: 'pending' | 'submitted' | 'completed'
  readonly submittedAt?: string
  readonly submissionAttemptId?: string
  readonly completedAt?: string
  readonly completionAttemptId?: string
  readonly outcome?: 'passed' | 'needs-review'
}

export type DayProgressStatus = 'not-started' | 'in-progress' | 'ready-for-review' | 'completed'

export interface DaySelfAssessment {
  readonly confidence: 'low' | 'medium' | 'high'
  readonly note?: string
  readonly updatedAt: string
}

/** DayProgress is navigation/draft state, not proof of mastery. */
export interface DayProgress {
  readonly dayId: DayId
  readonly status: DayProgressStatus
  readonly visitedSections: readonly string[]
  readonly drafts: Readonly<Record<string, string>>
  readonly startedAt?: string
  readonly updatedAt?: string
  readonly completedAt?: string
  readonly selfAssessment?: DaySelfAssessment
}

export interface EvidenceState {
  readonly version: 2
  readonly attempts: readonly AttemptRecord[]
  readonly assessments: readonly AssessmentRecord[]
  readonly mistakes: readonly MistakeRecord[]
  readonly reviewTasks: readonly ReviewTask[]
  readonly dayProgress: Readonly<Record<string, DayProgress>>
}

export type EvidenceMasteryLevel = 0 | 1 | 2 | 3

export interface MasterySummary {
  readonly conceptId: string
  readonly level: EvidenceMasteryLevel
  readonly mastered: boolean
  readonly passedKinds: readonly AttemptKind[]
  readonly missingKinds: readonly AttemptKind[]
  readonly evidenceAttemptIds: readonly string[]
  readonly latestEvidenceAt?: string
  readonly reason: string
}

export interface EvidenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const ATTEMPT_KINDS: readonly AttemptKind[] = [
  'closed-book-explanation',
  'practical-operation',
  'independent-variation',
  'work-product',
  'spaced-retest',
  'transfer',
  'targeted-practice',
  'reading',
  'self-assessment',
]

const VERIFICATION_METHODS: readonly VerificationMethod[] = ['system', 'rubric', 'reviewer', 'self']
const ASSESSMENT_METHODS: readonly AssessmentMethod[] = ['rubric', 'reviewer']
const ASSESSOR_ROLES: readonly AssessorRole[] = ['learner-with-rubric', 'peer', 'mentor', 'instructor']
const REVIEW_STAGES: readonly ReviewStage[] = REVIEW_SCHEDULE.map((item) => item.stage)
const DAY_STATUSES: readonly DayProgressStatus[] = ['not-started', 'in-progress', 'ready-for-review', 'completed']
const MASTERY_KINDS: readonly AttemptKind[] = [
  'closed-book-explanation',
  'practical-operation',
  'independent-variation',
  'work-product',
  'spaced-retest',
  'transfer',
]
const CORE_MASTERY_KINDS: readonly AttemptKind[] = [
  'closed-book-explanation',
  'practical-operation',
  'independent-variation',
  'work-product',
]
export const RUBRIC_REVIEW_KINDS: readonly AttemptKind[] = [
  'closed-book-explanation',
  'independent-variation',
  'work-product',
  'transfer',
]
const WORK_PRODUCT_PASS_SCORE = 80

export function createEvidenceState(): EvidenceState {
  return { version: 2, attempts: [], assessments: [], mistakes: [], reviewTasks: [], dayProgress: {} }
}

export const defaultEvidenceState: EvidenceState = createEvidenceState()

/** Deterministic ID helper. Pass a sequence when two records share a timestamp. */
export function makeEvidenceId(...parts: readonly (string | number)[]): string {
  return parts.map((part) => encodeURIComponent(String(part))).join('::')
}

/** Pure, immutable append. An existing ID is treated as an idempotent replay. */
export function addAttempt(state: EvidenceState, attempt: AttemptRecord): EvidenceState {
  if (state.attempts.some((item) => item.id === attempt.id)) return state
  const normalized = normalizeAttempt(attempt)
  if (!normalized) return state
  return { ...state, attempts: [...state.attempts, normalized] }
}

export const appendAttempt = addAttempt

export function addAssessment(state: EvidenceState, assessment: AssessmentRecord): EvidenceState {
  if (state.assessments.some((item) => item.id === assessment.id)) return state
  const normalized = normalizeAssessment(assessment)
  if (!normalized || !state.attempts.some((attempt) => attempt.id === normalized.attemptId)) return state
  if (normalized.supersedesId) {
    const superseded = state.assessments.find((item) => item.id === normalized.supersedesId)
    if (!superseded || superseded.attemptId !== normalized.attemptId) return state
  }
  return { ...state, assessments: [...state.assessments, normalized] }
}

export const assessAttempt = addAssessment

/**
 * A verified pass excludes self-report, reading and self-assessment records.
 * A work product additionally needs a numeric quality score >= 80.
 */
export function isVerifiedPass(attempt: AttemptRecord): boolean {
  if (!attempt.passed || attempt.verification === 'self') return false
  if (attempt.kind === 'reading' || attempt.kind === 'self-assessment') return false
  if (typeof attempt.score === 'number' && attempt.score < 0) return false
  if (attempt.kind === 'work-product') {
    return typeof attempt.score === 'number' && attempt.score >= WORK_PRODUCT_PASS_SCORE
  }
  return true
}

export function getEffectiveAssessment(
  state: EvidenceState,
  attemptId: string,
): AssessmentRecord | undefined {
  const assessments = state.assessments.filter((item) => item.attemptId === attemptId && !item.voided)
  if (!assessments.length) return undefined
  const supersededIds = new Set(assessments.map((item) => item.supersedesId).filter(isPresent))
  return assessments
    .filter((item) => !supersededIds.has(item.id))
    .slice()
    .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt) || right.id.localeCompare(left.id))[0]
}

/**
 * Returns the newest learner submission for each reviewable lesson activity.
 * Older revisions stay in the append-only ledger, but they do not clutter the
 * active queue once a newer attempt for the same activity exists.
 */
export function getAssessmentQueue(
  state: EvidenceState,
  kinds: readonly AttemptKind[] = RUBRIC_REVIEW_KINDS,
): readonly AttemptRecord[] {
  const newestByActivity = new Map<string, AttemptRecord>()
  state.attempts
    .filter((attempt) => kinds.includes(attempt.kind))
    .slice()
    .sort((left, right) => right.attemptedAt.localeCompare(left.attemptedAt) || right.id.localeCompare(left.id))
    .forEach((attempt) => {
      const key = `${attempt.dayId}\u0000${attempt.activityId}\u0000${attempt.kind}`
      if (!newestByActivity.has(key)) newestByActivity.set(key, attempt)
    })

  return [...newestByActivity.values()]
    .filter((attempt) => !isAttemptVerifiedPass(state, attempt))
    .sort((left, right) => left.attemptedAt.localeCompare(right.attemptedAt) || left.id.localeCompare(right.id))
}

/** A submission is verified either directly by the system/legacy reviewer or
 * by the latest non-voided append-only assessment. */
export function isAttemptVerifiedPass(state: EvidenceState, attempt: AttemptRecord): boolean {
  if (isVerifiedPass(attempt)) {
    if (attempt.kind !== 'transfer') return true
    const context = attempt.transferContext
    return Boolean(context && context.scenarioId !== context.sourceScenarioId && context.changedDimensions.length)
  }
  if (attempt.kind === 'reading' || attempt.kind === 'self-assessment') return false
  const assessment = getEffectiveAssessment(state, attempt.id)
  if (!assessment?.passed) return false
  if (attempt.kind === 'work-product') return assessment.score >= WORK_PRODUCT_PASS_SCORE
  if (attempt.kind === 'transfer') {
    const context = attempt.transferContext
    if (!context || context.scenarioId === context.sourceScenarioId || !context.changedDimensions.length) return false
  }
  return true
}

export interface NewMistakeRecord {
  readonly id: string
  readonly dayId: DayId
  readonly questionId: string
  readonly originalQuestion: string
  readonly userAnswer: string
  readonly correctAnswer: string
  readonly errorReason: string
  readonly conceptIds: readonly string[]
  readonly remediation: RemediationLocation
  readonly sourceAttemptId?: string
  readonly createdAt: string
}

/** Pure constructor. A new mistake is due for its first retest on D1. */
export function createMistakeRecord(input: NewMistakeRecord): MistakeRecord {
  return {
    ...input,
    conceptIds: uniqueStrings(input.conceptIds),
    status: 'open',
    nextRetestOn: addDaysToDate(input.createdAt, 1),
    retests: [],
  }
}

/** Pure, immutable mistake append. IDs are idempotent. */
export function recordMistake(state: EvidenceState, mistake: MistakeRecord): EvidenceState {
  if (state.mistakes.some((item) => item.id === mistake.id)) return state
  const normalized = normalizeMistake(mistake)
  if (!normalized) return state
  return { ...state, mistakes: [...state.mistakes, normalized] }
}

/**
 * Records a retest from the immutable attempt ledger. A verified passing
 * attempt resolves the mistake; a failed retest keeps it open and schedules D1.
 */
export function recordMistakeRetest(
  state: EvidenceState,
  mistakeId: string,
  attemptId: string,
): EvidenceState {
  const attempt = state.attempts.find((item) => item.id === attemptId)
  const mistake = state.mistakes.find((item) => item.id === mistakeId)
  if (!attempt || !mistake || mistake.retests.some((item) => item.attemptId === attemptId)) return state
  if (!attempt.conceptIds.some((conceptId) => mistake.conceptIds.includes(conceptId))) return state
  if (!['targeted-practice', 'spaced-retest'].includes(attempt.kind)) return state

  const passed = isAttemptVerifiedPass(state, attempt)
  const retest: MistakeRetest = { attemptId, attemptedAt: attempt.attemptedAt, passed }
  const updated: MistakeRecord = passed
    ? {
        ...mistake,
        status: 'resolved',
        retests: [...mistake.retests, retest],
        resolvedAt: attempt.attemptedAt,
        resolutionAttemptId: attempt.id,
        nextRetestOn: undefined,
      }
    : {
        ...mistake,
        status: 'open',
        retests: [...mistake.retests, retest],
        nextRetestOn: addDaysToDate(attempt.attemptedAt, 1),
      }

  return replaceMistake(state, updated)
}

/** Resolves only when the supplied ledger attempt is a verified pass. */
export function resolveMistake(state: EvidenceState, mistakeId: string, attemptId: string): EvidenceState {
  const attempt = state.attempts.find((item) => item.id === attemptId)
  if (!attempt || !isAttemptVerifiedPass(state, attempt)) return state
  return recordMistakeRetest(state, mistakeId, attemptId)
}

export function getOpenMistakes(state: EvidenceState, conceptId?: string): readonly MistakeRecord[] {
  return state.mistakes.filter(
    (mistake) => mistake.status === 'open' && (!conceptId || mistake.conceptIds.includes(conceptId)),
  )
}

export interface ReviewScheduleInput {
  readonly dayId: DayId
  readonly conceptIds: readonly string[]
  /** ISO date or timestamp on which the concept was first evidenced. */
  readonly learnedAt: string
  readonly sourceAttemptId?: string
}

/** Builds all D1/D3/D7/D14/D30/D60 tasks without touching storage. */
export function createReviewTasks(input: ReviewScheduleInput): readonly ReviewTask[] {
  const learnedOn = dateOnly(input.learnedAt)
  if (!learnedOn) return []
  return uniqueStrings(input.conceptIds).flatMap((conceptId) =>
    REVIEW_SCHEDULE.map(({ stage, days }) => ({
      id: makeEvidenceId('review', input.dayId, conceptId, learnedOn, stage),
      dayId: input.dayId,
      conceptId,
      stage,
      dueOn: addDaysToDate(learnedOn, days),
      sourceAttemptId: input.sourceAttemptId,
      status: 'pending' as const,
    })),
  )
}

/** Pure, immutable schedule merge; repeated scheduling cannot duplicate tasks. */
export function scheduleReviewTasks(state: EvidenceState, input: ReviewScheduleInput): EvidenceState {
  const knownIds = new Set(state.reviewTasks.map((task) => task.id))
  const additions = createReviewTasks(input).filter((task) => !knownIds.has(task.id))
  if (!additions.length) return state
  return { ...state, reviewTasks: [...state.reviewTasks, ...additions] }
}

/** A review is completed by an actual attempt, not by a confidence button. */
export function completeReviewTask(
  state: EvidenceState,
  taskId: string,
  attemptId: string,
): EvidenceState {
  const task = state.reviewTasks.find((item) => item.id === taskId)
  const attempt = state.attempts.find((item) => item.id === attemptId)
  if (!task || task.status === 'completed' || !attempt) return state
  if (task.status === 'submitted' && task.submissionAttemptId !== attempt.id) return state
  if (!isReviewAttemptForTask(task, attempt)) return state
  const hasDirectVerdict = attempt.verification !== 'self'
  if (!hasDirectVerdict && !getEffectiveAssessment(state, attempt.id)) return state

  const updated: ReviewTask = {
    ...task,
    status: 'completed',
    completedAt: attempt.attemptedAt,
    completionAttemptId: attempt.id,
    submittedAt: task.submittedAt ?? attempt.attemptedAt,
    submissionAttemptId: task.submissionAttemptId ?? attempt.id,
    outcome: isAttemptVerifiedPass(state, attempt) ? 'passed' : 'needs-review',
  }
  return {
    ...state,
    reviewTasks: state.reviewTasks.map((item) => (item.id === taskId ? updated : item)),
  }
}

/** Records a real retest submission without claiming that it has passed. */
export function submitReviewAttempt(
  state: EvidenceState,
  taskId: string,
  attempt: AttemptRecord,
): EvidenceState {
  const task = state.reviewTasks.find((item) => item.id === taskId)
  if (!task || task.status === 'completed' || !isReviewAttemptForTask(task, attempt)) return state
  const withAttempt = addAttempt(state, attempt)
  if (!withAttempt.attempts.some((item) => item.id === attempt.id)) return state
  const updated: ReviewTask = {
    ...task,
    status: 'submitted',
    submittedAt: attempt.attemptedAt,
    submissionAttemptId: attempt.id,
  }
  return {
    ...withAttempt,
    reviewTasks: withAttempt.reviewTasks.map((item) => (item.id === taskId ? updated : item)),
  }
}

/** Replaces only the task's active submission pointer; earlier attempts and
 * assessments remain append-only in the ledger. */
export function resubmitReviewAttempt(
  state: EvidenceState,
  taskId: string,
  attempt: AttemptRecord,
): EvidenceState {
  const task = state.reviewTasks.find((item) => item.id === taskId)
  if (!task || task.status !== 'submitted' || !isReviewAttemptForTask(task, attempt)) return state
  const withAttempt = addAttempt(state, attempt)
  if (!withAttempt.attempts.some((item) => item.id === attempt.id)) return state
  return {
    ...withAttempt,
    reviewTasks: withAttempt.reviewTasks.map((item) => item.id === taskId ? {
      ...item,
      submittedAt: attempt.attemptedAt,
      submissionAttemptId: attempt.id,
    } : item),
  }
}

function isReviewAttemptForTask(task: ReviewTask, attempt: AttemptRecord): boolean {
  return attempt.kind === 'spaced-retest'
    && attempt.reviewTaskId === task.id
    && attempt.reviewStage === task.stage
    && attempt.dayId === task.dayId
    && attempt.conceptIds.includes(task.conceptId)
    && (dateOnly(attempt.attemptedAt) ?? '') >= task.dueOn
}

export function getDueReviewTasks(state: EvidenceState, onDate: string): readonly ReviewTask[] {
  const today = dateOnly(onDate)
  if (!today) return []
  return state.reviewTasks
    .filter((task) => task.status !== 'completed' && task.dueOn <= today)
    .slice()
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.stage.localeCompare(b.stage))
}

/** Saves a named lesson draft without treating it as evidence. */
export function saveDayDraft(
  state: EvidenceState,
  dayId: DayId,
  draftKey: string,
  value: string,
  updatedAt: string,
): EvidenceState {
  if (!draftKey.trim()) return state
  const current = state.dayProgress[dayId] ?? emptyDayProgress(dayId, updatedAt)
  const updated: DayProgress = {
    ...current,
    status: current.status === 'not-started' ? 'in-progress' : current.status,
    startedAt: current.startedAt ?? updatedAt,
    updatedAt,
    drafts: { ...current.drafts, [draftKey]: value },
  }
  return setDayProgress(state, updated)
}

export function removeDayDraft(
  state: EvidenceState,
  dayId: DayId,
  draftKey: string,
  updatedAt: string,
): EvidenceState {
  const current = state.dayProgress[dayId]
  if (!current || !(draftKey in current.drafts)) return state
  const drafts = { ...current.drafts }
  delete drafts[draftKey]
  return setDayProgress(state, { ...current, drafts, updatedAt })
}

export function markSectionVisited(
  state: EvidenceState,
  dayId: DayId,
  sectionId: string,
  updatedAt: string,
): EvidenceState {
  if (!sectionId.trim()) return state
  const current = state.dayProgress[dayId] ?? emptyDayProgress(dayId, updatedAt)
  const visitedSections = current.visitedSections.includes(sectionId)
    ? current.visitedSections
    : [...current.visitedSections, sectionId]
  return setDayProgress(state, {
    ...current,
    status: current.status === 'not-started' ? 'in-progress' : current.status,
    visitedSections,
    startedAt: current.startedAt ?? updatedAt,
    updatedAt,
  })
}

/** Completion is stored for navigation only and cannot change mastery. */
export function setDayProgressStatus(
  state: EvidenceState,
  dayId: DayId,
  status: DayProgressStatus,
  updatedAt: string,
): EvidenceState {
  const current = state.dayProgress[dayId] ?? emptyDayProgress(dayId, updatedAt)
  return setDayProgress(state, {
    ...current,
    status,
    startedAt: status === 'not-started' ? current.startedAt : current.startedAt ?? updatedAt,
    updatedAt,
    completedAt: status === 'completed' ? updatedAt : undefined,
  })
}

/** Stores confidence for reflection; deriveConceptMastery never reads it. */
export function saveDaySelfAssessment(
  state: EvidenceState,
  dayId: DayId,
  assessment: Omit<DaySelfAssessment, 'updatedAt'>,
  updatedAt: string,
): EvidenceState {
  const current = state.dayProgress[dayId] ?? emptyDayProgress(dayId, updatedAt)
  return setDayProgress(state, {
    ...current,
    updatedAt,
    selfAssessment: { ...assessment, updatedAt },
  })
}

export function getDayProgress(state: EvidenceState, dayId: DayId): DayProgress {
  return state.dayProgress[dayId] ?? {
    dayId,
    status: 'not-started',
    visitedSections: [],
    drafts: {},
  }
}

/**
 * Mastery rules:
 * L0: no verified authentic evidence.
 * L1: at least one verified core evidence kind.
 * L2: closed-book explanation + practical operation + independent variation
 *     + work product scoring >= 80.
 * L3: L2 plus a verified retest on a later calendar date and transfer to a
 *     new work scenario. Reading, completion and self-assessment are ignored.
 */
export function deriveConceptMastery(state: EvidenceState, conceptId: string): MasterySummary {
  const verified = state.attempts
    .filter((attempt) => attempt.conceptIds.includes(conceptId))
    .filter((attempt) => MASTERY_KINDS.includes(attempt.kind) && isAttemptVerifiedPass(state, attempt))

  const corePassed = CORE_MASTERY_KINDS.filter((kind) => verified.some((attempt) => attempt.kind === kind))
  const coreDates = verified
    .filter((attempt) => CORE_MASTERY_KINDS.includes(attempt.kind))
    .map((attempt) => dateOnly(attempt.attemptedAt))
    .filter((value): value is string => Boolean(value))
    .sort()
  const firstCoreDate = coreDates[0]
  const hasLaterRetest = Boolean(
    firstCoreDate &&
      verified.some(
        (attempt) => attempt.kind === 'spaced-retest'
          && !['D1', 'D3'].includes(attempt.reviewStage ?? '')
          && (dateOnly(attempt.attemptedAt) ?? '') > firstCoreDate,
      ),
  )
  const hasTransfer = verified.some((attempt) => attempt.kind === 'transfer')
  const hasAllCore = corePassed.length === CORE_MASTERY_KINDS.length

  let level: EvidenceMasteryLevel = 0
  if (corePassed.length > 0) level = 1
  if (hasAllCore) level = 2
  if (hasAllCore && hasLaterRetest && hasTransfer) level = 3

  const passedKinds: AttemptKind[] = [...corePassed]
  if (hasLaterRetest) passedKinds.push('spaced-retest')
  if (hasTransfer) passedKinds.push('transfer')
  const missingKinds = MASTERY_KINDS.filter((kind) => !passedKinds.includes(kind))
  const latestEvidenceAt = verified
    .map((attempt) => attempt.attemptedAt)
    .slice()
    .sort()
    .at(-1)

  const reason =
    level === 3
      ? '已具备核心证据、跨日复测和新场景迁移证据。'
      : level === 2
        ? '核心能力证据已齐，仍需跨日复测与新场景迁移。'
        : level === 1
          ? '已有部分真实证据，但闭卷、操作、独立变式或成果证据尚未齐全。'
          : '尚无经系统、量规或他人验证的真实能力证据。'

  return {
    conceptId,
    level,
    mastered: level === 3,
    passedKinds,
    missingKinds,
    evidenceAttemptIds: verified.map((attempt) => attempt.id),
    latestEvidenceAt,
    reason,
  }
}

export function deriveMasteryMap(
  state: EvidenceState,
  conceptIds: readonly string[] = uniqueStrings(state.attempts.flatMap((attempt) => attempt.conceptIds)),
): Readonly<Record<string, MasterySummary>> {
  return Object.fromEntries(
    uniqueStrings(conceptIds)
      .sort((a, b) => a.localeCompare(b))
      .map((conceptId) => [conceptId, deriveConceptMastery(state, conceptId)]),
  )
}

/** Pure parser used by loadEvidenceState and suitable for tests/import flows. */
export function parseEvidenceState(raw: string | null | undefined): EvidenceState {
  if (!raw) return createEvidenceState()
  try {
    return normalizeEvidenceState(JSON.parse(raw))
  } catch {
    return createEvidenceState()
  }
}

export function serializeEvidenceState(state: EvidenceState): string {
  return JSON.stringify(normalizeEvidenceState(state))
}

/** Safe in SSR, privacy mode and malformed localStorage scenarios. */
export function loadEvidenceState(storage?: EvidenceStorage): EvidenceState {
  try {
    const target = storage ?? getBrowserStorage()
    return target ? parseEvidenceState(target.getItem(EVIDENCE_STORAGE_KEY)) : createEvidenceState()
  } catch {
    return createEvidenceState()
  }
}

/** Returns false instead of throwing when storage is unavailable or full. */
export function saveEvidenceState(state: EvidenceState, storage?: EvidenceStorage): boolean {
  try {
    const target = storage ?? getBrowserStorage()
    if (!target) return false
    target.setItem(EVIDENCE_STORAGE_KEY, serializeEvidenceState(state))
    return true
  } catch {
    return false
  }
}

/** Repairs partial/malformed v2 data and safely accepts compatible field aliases. */
export function normalizeEvidenceState(value: unknown): EvidenceState {
  if (!isObject(value)) return createEvidenceState()

  const attempts = dedupeById(asArray(value.attempts).map(normalizeAttempt).filter(isPresent))
  const attemptIds = new Set(attempts.map((item) => item.id))
  const assessments = dedupeById(asArray(value.assessments).map(normalizeAssessment).filter(isPresent))
    .filter((item) => attemptIds.has(item.attemptId))
  const mistakes = dedupeById(asArray(value.mistakes).map(normalizeMistake).filter(isPresent))
  const reviewTasks = dedupeById(asArray(value.reviewTasks).map(normalizeReviewTask).filter(isPresent))
  const dayProgress: Record<string, DayProgress> = {}
  const rawProgress = value.dayProgress

  if (Array.isArray(rawProgress)) {
    for (const item of rawProgress.map(normalizeDayProgress).filter(isPresent)) dayProgress[item.dayId] = item
  } else if (isObject(rawProgress)) {
    for (const [dayId, raw] of Object.entries(rawProgress)) {
      const item = normalizeDayProgress(isObject(raw) ? { ...raw, dayId: stringValue(raw.dayId) ?? dayId } : raw)
      if (item) dayProgress[item.dayId] = item
    }
  }

  return { version: 2, attempts, assessments, mistakes, reviewTasks, dayProgress }
}

export type ReplaceDayEvidenceResult =
  | { ok: true; state: EvidenceState }
  | { ok: false; reason: string }

/**
 * Replaces one Day in an imported archive while preserving every other Day.
 * The operation refuses to create or silently break cross-Day references.
 */
export function replaceDayEvidence(
  currentValue: unknown,
  archiveValue: unknown,
  dayId: DayId,
): ReplaceDayEvidenceResult {
  const archiveConflict = findConflictingRecordId(archiveValue)
  if (archiveConflict) {
    return { ok: false, reason: `归档中存在重复且内容冲突的 ${archiveConflict} ID，无法安全恢复。` }
  }
  const current = normalizeEvidenceState(currentValue)
  const archive = normalizeEvidenceState(archiveValue)
  const currentTargetAttempts = current.attempts.filter((item) => item.dayId === dayId)
  const currentTargetAttemptIds = new Set(currentTargetAttempts.map((item) => item.id))
  const currentTargetTasks = current.reviewTasks.filter((item) => item.dayId === dayId)
  const incomingAttempts = archive.attempts.filter((item) => item.dayId === dayId)
  const incomingAttemptIds = new Set(incomingAttempts.map((item) => item.id))
  const incomingAssessments = archive.assessments.filter((item) => incomingAttemptIds.has(item.attemptId))
  const incomingMistakes = archive.mistakes.filter((item) => item.dayId === dayId)
  const incomingTasks = archive.reviewTasks.filter((item) => item.dayId === dayId)
  const retainedAttempts = current.attempts.filter((item) => item.dayId !== dayId)
  const retainedAssessments = current.assessments.filter((item) => !currentTargetAttemptIds.has(item.attemptId))
  const retainedMistakes = current.mistakes.filter((item) => item.dayId !== dayId)
  const retainedTasks = current.reviewTasks.filter((item) => item.dayId !== dayId)

  const incomingTaskIds = new Set(incomingTasks.map((item) => item.id))
  const removedAttemptIds = new Set(currentTargetAttempts.map((item) => item.id).filter((id) => !incomingAttemptIds.has(id)))
  const removedTaskIds = new Set(currentTargetTasks.map((item) => item.id).filter((id) => !incomingTaskIds.has(id)))

  const retainedReferencesRemovedAttempt = retainedMistakes.some((item) => mistakeAttemptReferences(item).some((id) => removedAttemptIds.has(id)))
    || retainedTasks.some((item) => taskAttemptReferences(item).some((id) => removedAttemptIds.has(id)))
  const retainedReferencesRemovedTask = retainedAttempts.some((item) => Boolean(item.reviewTaskId && removedTaskIds.has(item.reviewTaskId)))
  if (retainedReferencesRemovedAttempt || retainedReferencesRemovedTask) {
    return { ok: false, reason: '其他 Day 正在引用将被替换的 W1D1 证据。为避免破坏跨日复测链，本次局部恢复已取消。' }
  }

  const retainedAttemptById = new Map(retainedAttempts.map((item) => [item.id, item]))
  const retainedAssessmentById = new Map(retainedAssessments.map((item) => [item.id, item]))
  const retainedTaskById = new Map(retainedTasks.map((item) => [item.id, item]))
  for (const item of incomingAttempts) {
    const conflict = retainedAttemptById.get(item.id)
    if (conflict && canonicalRecord(conflict) !== canonicalRecord(item)) {
      return { ok: false, reason: '归档中的 W1D1 尝试 ID 与其他 Day 记录冲突，无法安全恢复。' }
    }
  }
  for (const item of incomingTasks) {
    const conflict = retainedTaskById.get(item.id)
    if (conflict && canonicalRecord(conflict) !== canonicalRecord(item)) {
      return { ok: false, reason: '归档中的 W1D1 复习任务 ID 与其他 Day 记录冲突，无法安全恢复。' }
    }
  }
  for (const item of incomingAssessments) {
    const conflict = retainedAssessmentById.get(item.id)
    if (conflict && canonicalRecord(conflict) !== canonicalRecord(item)) {
      return { ok: false, reason: '归档中的 W1D1 审核 ID 与其他 Day 记录冲突，无法安全恢复。' }
    }
  }

  const nextAttemptIds = new Set([...retainedAttempts, ...incomingAttempts].map((item) => item.id))
  const nextTaskIds = new Set([...retainedTasks, ...incomingTasks].map((item) => item.id))
  const incomingHasDanglingReference = incomingMistakes.some((item) => mistakeAttemptReferences(item).some((id) => !nextAttemptIds.has(id)))
    || incomingTasks.some((item) => taskAttemptReferences(item).some((id) => !nextAttemptIds.has(id)))
    || incomingAttempts.some((item) => Boolean(item.reviewTaskId && !nextTaskIds.has(item.reviewTaskId)))
  if (incomingHasDanglingReference) {
    return { ok: false, reason: '归档中的 W1D1 记录缺少所引用的尝试或复习任务，无法安全恢复。' }
  }

  const dayProgress: Record<string, DayProgress> = { ...current.dayProgress }
  delete dayProgress[dayId]
  if (archive.dayProgress[dayId]) dayProgress[dayId] = archive.dayProgress[dayId]
  const state = normalizeEvidenceState({
    version: 2,
    attempts: [...retainedAttempts, ...incomingAttempts],
    assessments: [...retainedAssessments, ...incomingAssessments],
    mistakes: [...retainedMistakes, ...incomingMistakes],
    reviewTasks: [...retainedTasks, ...incomingTasks],
    dayProgress,
  })
  return { ok: true, state }
}

export function addDaysToDate(value: string, days: number): string {
  const base = dateOnly(value)
  if (!base) return ''
  const date = new Date(`${base}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function emptyDayProgress(dayId: DayId, startedAt: string): DayProgress {
  return {
    dayId,
    status: 'in-progress',
    visitedSections: [],
    drafts: {},
    startedAt,
    updatedAt: startedAt,
  }
}

function setDayProgress(state: EvidenceState, progress: DayProgress): EvidenceState {
  return { ...state, dayProgress: { ...state.dayProgress, [progress.dayId]: progress } }
}

function replaceMistake(state: EvidenceState, mistake: MistakeRecord): EvidenceState {
  return {
    ...state,
    mistakes: state.mistakes.map((item) => (item.id === mistake.id ? mistake : item)),
  }
}

function mistakeAttemptReferences(mistake: MistakeRecord): string[] {
  return uniqueStrings([
    ...(mistake.sourceAttemptId ? [mistake.sourceAttemptId] : []),
    ...mistake.retests.map((item) => item.attemptId),
    ...(mistake.resolutionAttemptId ? [mistake.resolutionAttemptId] : []),
  ])
}

function taskAttemptReferences(task: ReviewTask): string[] {
  return uniqueStrings([
    ...(task.sourceAttemptId ? [task.sourceAttemptId] : []),
    ...(task.completionAttemptId ? [task.completionAttemptId] : []),
  ])
}

function canonicalRecord(value: unknown): string {
  if (!isObject(value)) return JSON.stringify(value)
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))
}

function findConflictingRecordId(value: unknown): '尝试' | '审核' | '错题' | '复习任务' | undefined {
  if (!isObject(value)) return undefined
  const groups: Array<{ values: unknown[]; label: '尝试' | '审核' | '错题' | '复习任务' }> = [
    { values: asArray(value.attempts), label: '尝试' },
    { values: asArray(value.assessments), label: '审核' },
    { values: asArray(value.mistakes), label: '错题' },
    { values: asArray(value.reviewTasks), label: '复习任务' },
  ]
  for (const group of groups) {
    const records = new Map<string, string>()
    for (const item of group.values) {
      if (!isObject(item)) continue
      const id = stringValue(item.id)
      if (!id) continue
      const canonical = canonicalRecord(item)
      const existing = records.get(id)
      if (existing && existing !== canonical) return group.label
      records.set(id, canonical)
    }
  }
  return undefined
}

function getBrowserStorage(): EvidenceStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function normalizeAttempt(value: unknown): AttemptRecord | undefined {
  if (!isObject(value)) return undefined
  const id = stringValue(value.id)
  const dayId = dayIdValue(value.dayId)
  const activityId = stringValue(value.activityId)
  const attemptedAt = stringValue(value.attemptedAt)
  if (!id || !dayId || !activityId || !attemptedAt) return undefined

  const rawKind = stringValue(value.kind)
  const kind = ATTEMPT_KINDS.includes(rawKind as AttemptKind)
    ? (rawKind as AttemptKind)
    : 'self-assessment'
  const rawVerification = stringValue(value.verification)
  const verification = VERIFICATION_METHODS.includes(rawVerification as VerificationMethod)
    ? (rawVerification as VerificationMethod)
    : 'self'
  const conceptIds = uniqueStrings([
    ...stringArray(value.conceptIds),
    ...(stringValue(value.conceptId) ? [stringValue(value.conceptId)!] : []),
  ])
  const rawStage = stringValue(value.reviewStage)
  const score = numberValue(value.score)

  return {
    id,
    dayId,
    activityId,
    conceptIds,
    kind,
    attemptedAt,
    passed: value.passed === true,
    score: score === undefined ? undefined : Math.min(100, Math.max(0, score)),
    verification,
    evidence: stringValue(value.evidence),
    feedback: stringValue(value.feedback),
    reviewStage: REVIEW_STAGES.includes(rawStage as ReviewStage) ? (rawStage as ReviewStage) : undefined,
    reviewTaskId: stringValue(value.reviewTaskId),
    transferContext: normalizeTransferContext(value.transferContext),
  }
}

function normalizeTransferContext(value: unknown): AttemptRecord['transferContext'] | undefined {
  if (!isObject(value)) return undefined
  const sourceScenarioId = stringValue(value.sourceScenarioId)
  const scenarioId = stringValue(value.scenarioId)
  const changedDimensions = uniqueStrings(stringArray(value.changedDimensions))
  if (!sourceScenarioId || !scenarioId || !changedDimensions.length) return undefined
  return { sourceScenarioId, scenarioId, changedDimensions }
}

function normalizeAssessment(value: unknown): AssessmentRecord | undefined {
  if (!isObject(value)) return undefined
  const id = stringValue(value.id)
  const attemptId = stringValue(value.attemptId)
  const rawMethod = stringValue(value.method)
  const method = ASSESSMENT_METHODS.includes(rawMethod as AssessmentMethod)
    ? (rawMethod as AssessmentMethod)
    : undefined
  const rawRole = stringValue(value.assessorRole)
  const assessorRole = ASSESSOR_ROLES.includes(rawRole as AssessorRole)
    ? (rawRole as AssessorRole)
    : undefined
  const rubricId = stringValue(value.rubricId)
  const rubricVersion = stringValue(value.rubricVersion)
  const reviewedAt = stringValue(value.reviewedAt)
  const feedback = stringValue(value.feedback)
  const rawScore = numberValue(value.score)
  if (!id || !attemptId || !method || !assessorRole || !rubricId || !rubricVersion || !reviewedAt || !feedback || rawScore === undefined) {
    return undefined
  }

  const criteria = asArray(value.criteria)
    .map((item): AssessmentCriterionScore | undefined => {
      if (!isObject(item)) return undefined
      const criterionId = stringValue(item.criterionId)
      const score = numberValue(item.score)
      const maximumScore = numberValue(item.maximumScore)
      if (!criterionId || score === undefined || maximumScore === undefined || maximumScore <= 0) return undefined
      return {
        criterionId,
        score: Math.min(maximumScore, Math.max(0, score)),
        maximumScore,
        feedback: stringValue(item.feedback),
      }
    })
    .filter(isPresent)
  if (!criteria.length) return undefined

  return {
    id,
    attemptId,
    method,
    assessorRole,
    rubricId,
    rubricVersion,
    criteria,
    score: Math.min(100, Math.max(0, rawScore)),
    passed: value.passed === true,
    reviewedAt,
    feedback,
    supersedesId: stringValue(value.supersedesId),
    voided: value.voided === true || undefined,
  }
}

function normalizeMistake(value: unknown): MistakeRecord | undefined {
  if (!isObject(value)) return undefined
  const id = stringValue(value.id)
  const dayId = dayIdValue(value.dayId)
  const questionId = stringValue(value.questionId)
  const createdAt = stringValue(value.createdAt)
  if (!id || !dayId || !questionId || !createdAt) return undefined

  const remediationRaw = isObject(value.remediation) ? value.remediation : {}
  const remediationDayId = dayIdValue(remediationRaw.dayId) ?? dayId
  const sectionId = stringValue(remediationRaw.sectionId) ?? stringValue(value.remediationSectionId) ?? 'concepts'
  const retests = asArray(value.retests)
    .map((item): MistakeRetest | undefined => {
      if (!isObject(item)) return undefined
      const attemptId = stringValue(item.attemptId)
      const attemptedAt = stringValue(item.attemptedAt)
      return attemptId && attemptedAt ? { attemptId, attemptedAt, passed: item.passed === true } : undefined
    })
    .filter(isPresent)

  return {
    id,
    dayId,
    questionId,
    originalQuestion: stringValue(value.originalQuestion) ?? '',
    userAnswer: stringValue(value.userAnswer) ?? '',
    correctAnswer: stringValue(value.correctAnswer) ?? '',
    errorReason: stringValue(value.errorReason) ?? '',
    conceptIds: uniqueStrings([
      ...stringArray(value.conceptIds),
      ...(stringValue(value.conceptId) ? [stringValue(value.conceptId)!] : []),
    ]),
    remediation: {
      dayId: remediationDayId,
      sectionId,
      anchor: stringValue(remediationRaw.anchor),
    },
    sourceAttemptId: stringValue(value.sourceAttemptId),
    createdAt,
    status: value.status === 'resolved' ? 'resolved' : 'open',
    nextRetestOn: stringValue(value.nextRetestOn) ?? stringValue(value.nextReviewAt),
    retests,
    resolvedAt: stringValue(value.resolvedAt),
    resolutionAttemptId: stringValue(value.resolutionAttemptId),
  }
}

function normalizeReviewTask(value: unknown): ReviewTask | undefined {
  if (!isObject(value)) return undefined
  const id = stringValue(value.id)
  const dayId = dayIdValue(value.dayId) ?? dayIdValue(value.sourceDayId)
  const conceptId = stringValue(value.conceptId)
  const rawStage = stringValue(value.stage)
  const stage = REVIEW_STAGES.includes(rawStage as ReviewStage) ? (rawStage as ReviewStage) : undefined
  const dueOn = stringValue(value.dueOn) ?? stringValue(value.dueAt)
  if (!id || !dayId || !conceptId || !stage || !dueOn) return undefined

  return {
    id,
    dayId,
    conceptId,
    stage,
    dueOn: dateOnly(dueOn) ?? dueOn,
    sourceAttemptId: stringValue(value.sourceAttemptId),
    status: value.status === 'completed' || stringValue(value.completedAt)
      ? 'completed'
      : value.status === 'submitted' || stringValue(value.submissionAttemptId)
        ? 'submitted'
        : 'pending',
    submittedAt: stringValue(value.submittedAt),
    submissionAttemptId: stringValue(value.submissionAttemptId),
    completedAt: stringValue(value.completedAt),
    completionAttemptId: stringValue(value.completionAttemptId) ?? stringValue(value.attemptId),
    outcome: value.outcome === 'passed' || value.outcome === 'needs-review' ? value.outcome : undefined,
  }
}

function normalizeDayProgress(value: unknown): DayProgress | undefined {
  if (!isObject(value)) return undefined
  const dayId = dayIdValue(value.dayId)
  if (!dayId) return undefined
  const rawStatus = stringValue(value.status)
  const status = DAY_STATUSES.includes(rawStatus as DayProgressStatus)
    ? (rawStatus as DayProgressStatus)
    : 'not-started'
  const drafts: Record<string, string> = {}
  if (isObject(value.drafts)) {
    for (const [key, draft] of Object.entries(value.drafts)) if (typeof draft === 'string') drafts[key] = draft
  }

  let selfAssessment: DaySelfAssessment | undefined
  if (isObject(value.selfAssessment)) {
    const confidence = value.selfAssessment.confidence
    const updatedAt = stringValue(value.selfAssessment.updatedAt)
    if ((confidence === 'low' || confidence === 'medium' || confidence === 'high') && updatedAt) {
      selfAssessment = { confidence, note: stringValue(value.selfAssessment.note), updatedAt }
    }
  }

  return {
    dayId,
    status,
    visitedSections: uniqueStrings(stringArray(value.visitedSections)),
    drafts,
    startedAt: stringValue(value.startedAt),
    updatedAt: stringValue(value.updatedAt),
    completedAt: stringValue(value.completedAt),
    selfAssessment,
  }
}

function dateOnly(value: string): string | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return undefined
  const result = `${match[1]}-${match[2]}-${match[3]}`
  const date = new Date(`${result}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result ? undefined : result
}

function dayIdValue(value: unknown): DayId | undefined {
  return typeof value === 'string' && /^W\d+D\d+$/.test(value) ? (value as DayId) : undefined
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()).map((value) => value.trim()))]
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined
}

function dedupeById<T extends { readonly id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}
