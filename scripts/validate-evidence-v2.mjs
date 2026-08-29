import assert from 'node:assert/strict'
import {
  addAssessment,
  addAttempt,
  completeReviewTask,
  createEvidenceState,
  deriveConceptMastery,
  getAssessmentQueue,
  getDueReviewTasks,
  getEffectiveAssessment,
  isAttemptVerifiedPass,
  makeEvidenceId,
  scheduleReviewTasks,
  resubmitReviewAttempt,
  submitReviewAttempt,
} from '../src/evidenceStore.ts'

const dayId = 'W1D1'
const conceptId = 'dom'
const submittedAt = '2026-08-13T10:00:00.000Z'
const baseAttempt = {
  id: makeEvidenceId('attempt', dayId, 'deliverable', submittedAt),
  dayId,
  activityId: `${dayId}-deliverable`,
  conceptIds: [conceptId],
  kind: 'work-product',
  attemptedAt: submittedAt,
  passed: true,
  verification: 'self',
  evidence: '学习者提交的不可变成果正文',
}

let state = addAttempt(createEvidenceState(), baseAttempt)
assert.equal(isAttemptVerifiedPass(state, state.attempts[0]), false, '自评提交不能直接成为有效成果证据')
assert.deepEqual(getAssessmentQueue(state).map((attempt) => attempt.id), [baseAttempt.id], '待量规提交应进入审核队列')

const firstAssessment = {
  id: 'assessment-1',
  attemptId: baseAttempt.id,
  method: 'rubric',
  assessorRole: 'learner-with-rubric',
  rubricId: 'daily-work-product',
  rubricVersion: '1',
  criteria: [{ criterionId: 'accuracy', score: 72, maximumScore: 100 }],
  score: 72,
  passed: false,
  reviewedAt: '2026-08-13T11:00:00.000Z',
  feedback: '证据边界仍不完整。',
}
state = addAssessment(state, firstAssessment)
assert.equal(isAttemptVerifiedPass(state, state.attempts[0]), false, '低于 80 分的成果不能通过')

state = addAssessment(state, {
  ...firstAssessment,
  id: 'assessment-2',
  criteria: [{ criterionId: 'accuracy', score: 86, maximumScore: 100 }],
  score: 86,
  passed: true,
  reviewedAt: '2026-08-13T12:00:00.000Z',
  feedback: '职责、证据与限制均已写清。',
  supersedesId: firstAssessment.id,
})
assert.equal(getEffectiveAssessment(state, baseAttempt.id)?.id, 'assessment-2')
assert.equal(isAttemptVerifiedPass(state, state.attempts[0]), true, '通过复核后原始提交应派生为有效证据')
assert.equal(state.attempts[0].verification, 'self', '审核不得改写原始尝试')
assert.equal(getAssessmentQueue(state).some((attempt) => attempt.id === baseAttempt.id), false, '已通过提交应退出审核队列')

const olderExplanation = {
  id: 'explanation-old',
  dayId,
  activityId: `${dayId}-memory`,
  conceptIds: [conceptId],
  kind: 'closed-book-explanation',
  attemptedAt: '2026-08-13T08:00:00.000Z',
  passed: true,
  verification: 'self',
  evidence: '旧版闭卷解释',
}
const newerExplanation = { ...olderExplanation, id: 'explanation-new', attemptedAt: '2026-08-13T09:00:00.000Z', evidence: '修订后的闭卷解释' }
state = addAttempt(addAttempt(state, olderExplanation), newerExplanation)
assert.deepEqual(
  getAssessmentQueue(state).filter((attempt) => attempt.activityId === `${dayId}-memory`).map((attempt) => attempt.id),
  [newerExplanation.id],
  '同一活动只应展示最新修订，旧提交仍保留在账本中',
)

state = scheduleReviewTasks(state, {
  dayId,
  conceptIds: [conceptId],
  learnedAt: submittedAt,
  sourceAttemptId: baseAttempt.id,
})
const reviewTask = state.reviewTasks.find((task) => task.stage === 'D1')
assert.ok(reviewTask)

const invalidRetest = {
  id: 'invalid-retest',
  dayId,
  activityId: 'wrong-review',
  conceptIds: [conceptId],
  kind: 'spaced-retest',
  attemptedAt: '2026-08-14T10:00:00.000Z',
  passed: true,
  verification: 'system',
  reviewStage: 'D1',
  reviewTaskId: 'another-task',
}
assert.equal(submitReviewAttempt(state, reviewTask.id, invalidRetest), state, '复测必须精确关联任务')

const retest = {
  ...invalidRetest,
  id: 'valid-retest',
  activityId: `${reviewTask.id}-retest`,
  reviewTaskId: reviewTask.id,
}
state = submitReviewAttempt(state, reviewTask.id, retest)
assert.equal(state.reviewTasks.find((task) => task.id === reviewTask.id)?.status, 'submitted')
assert.equal(getDueReviewTasks(state, '2026-08-14').some((task) => task.id === reviewTask.id), true)
const revisedRetest = { ...retest, id: 'revised-retest', activityId: `${reviewTask.id}-revision`, evidence: '修订后的闭卷解释，补全了定义、证据、限制和一个不同场景。' }
state = resubmitReviewAttempt(state, reviewTask.id, revisedRetest)
assert.equal(state.reviewTasks.find((task) => task.id === reviewTask.id)?.submissionAttemptId, revisedRetest.id)
assert.equal(completeReviewTask(state, reviewTask.id, retest.id), state, '旧提交不能完成已切换到修订版的任务')
state = completeReviewTask(state, reviewTask.id, revisedRetest.id)
assert.equal(state.reviewTasks.find((task) => task.id === reviewTask.id)?.outcome, 'passed')
assert.equal(deriveConceptMastery(state, conceptId).passedKinds.includes('spaced-retest'), false, 'D1 复测不能满足长期保持证据')

const transferAttempt = {
  id: 'transfer-without-novelty',
  dayId,
  activityId: 'transfer-case',
  conceptIds: [conceptId],
  kind: 'transfer',
  attemptedAt: '2026-08-21T10:00:00.000Z',
  passed: true,
  verification: 'self',
  evidence: '把同一场景原样再做一次。',
  transferContext: {
    sourceScenarioId: 'checkout-page',
    scenarioId: 'checkout-page',
    changedDimensions: ['copy'],
  },
}
state = addAttempt(state, transferAttempt)
state = addAssessment(state, {
  id: 'assessment-transfer',
  attemptId: transferAttempt.id,
  method: 'reviewer',
  assessorRole: 'mentor',
  rubricId: 'transfer-evidence',
  rubricVersion: '1',
  criteria: [{ criterionId: 'novelty', score: 90, maximumScore: 100 }],
  score: 90,
  passed: true,
  reviewedAt: '2026-08-21T11:00:00.000Z',
  feedback: '场景没有变化，因此不能作为迁移。',
})
assert.equal(isAttemptVerifiedPass(state, state.attempts.find((attempt) => attempt.id === transferAttempt.id)), false)

state = addAttempt(state, {
  ...transferAttempt,
  id: 'system-transfer-without-novelty',
  verification: 'system',
})
assert.equal(isAttemptVerifiedPass(state, state.attempts.find((attempt) => attempt.id === 'system-transfer-without-novelty')), false)

console.log('Evidence v2 assessment and review validation passed.')
