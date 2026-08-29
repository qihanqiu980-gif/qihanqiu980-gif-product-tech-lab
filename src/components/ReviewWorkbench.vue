<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { listDailyCourses } from '../course/registry'
import {
  addAssessment,
  completeReviewTask,
  getDueReviewTasks,
  makeEvidenceId,
  resubmitReviewAttempt,
  submitReviewAttempt,
  type AssessmentRecord,
  type AttemptRecord,
  type EvidenceState,
  type ReviewTask,
} from '../evidenceStore'

const props = defineProps<{
  evidenceState: EvidenceState
  today: string
}>()

const emit = defineEmits<{
  change: [state: EvidenceState]
  openDay: [dayId: ReviewTask['dayId']]
}>()

const responses = reactive<Record<string, string>>({})
const accuracyChecks = reactive<Record<string, boolean>>({})
const boundaryChecks = reactive<Record<string, boolean>>({})
const statusMessage = ref('')
const openTaskId = ref('')

const dueTasks = computed(() => getDueReviewTasks(props.evidenceState, props.today))
const pendingTasks = computed(() => dueTasks.value.filter((task) => task.status === 'pending'))
const submittedTasks = computed(() => dueTasks.value.filter((task) => task.status === 'submitted'))
const conceptLabels = computed(() => new Map(
  listDailyCourses().flatMap((lesson) => lesson.concepts.map((concept) => [concept.id, concept.term] as const)),
))

function conceptLabel(task: ReviewTask) {
  return conceptLabels.value.get(task.conceptId) ?? task.conceptId
}

function promptFor(task: ReviewTask) {
  if (task.stage === 'D1') return '不看笔记，用自己的话解释定义与一项职责边界，并写出一条可观察证据。'
  if (task.stage === 'D3') return '解释这个概念与最容易混淆对象的差别，再说明一个错误判断为什么错。'
  if (task.stage === 'D7') return '在新的产品场景中推演它如何工作，并写出证据能证明和不能证明什么。'
  if (task.stage === 'D14') return '完成一个改变条件的微型案例，写出操作、结果、限制与下一步核验。'
  if (task.stage === 'D30') return '闭卷解释机制，并把它用于一份需求或故障证据，明确责任边界。'
  return '选择此前没使用过的工作场景，完成预测、操作、证据、结论、限制与迁移说明。'
}

function submit(task: ReviewTask) {
  const response = responses[task.id]?.trim() ?? ''
  if (response.length < 60) {
    statusMessage.value = `${task.stage} 复测至少需要 60 个有效字符，先把定义、证据和边界写完整。`
    openTaskId.value = task.id
    return
  }
  const at = new Date().toISOString()
  const attempt: AttemptRecord = {
    id: makeEvidenceId('review-attempt', task.id, at),
    dayId: task.dayId,
    activityId: `${task.id}-closed-book`,
    conceptIds: [task.conceptId],
    kind: 'spaced-retest',
    attemptedAt: at,
    passed: false,
    verification: 'self',
    evidence: response,
    reviewStage: task.stage,
    reviewTaskId: task.id,
    feedback: '复测答案已提交，等待逐项量规审核。',
  }
  emit('change', submitReviewAttempt(props.evidenceState, task.id, attempt))
  statusMessage.value = `${task.stage} 复测已提交；提交本身不会提高掌握等级，请继续完成量规审核。`
}

function assess(task: ReviewTask) {
  if (!task.submissionAttemptId) return
  const accuracy = accuracyChecks[task.id] === true
  const boundary = boundaryChecks[task.id] === true
  const score = (accuracy ? 50 : 0) + (boundary ? 50 : 0)
  const at = new Date().toISOString()
  const existing = props.evidenceState.assessments
    .filter((assessment) => assessment.attemptId === task.submissionAttemptId && !assessment.voided)
    .slice()
    .sort((left, right) => right.reviewedAt.localeCompare(left.reviewedAt))[0]
  const assessment: AssessmentRecord = {
    id: makeEvidenceId('assessment', task.submissionAttemptId, at),
    attemptId: task.submissionAttemptId,
    method: 'rubric',
    assessorRole: 'learner-with-rubric',
    rubricId: 'spaced-retest-core-v1',
    rubricVersion: '1',
    criteria: [
      { criterionId: 'accuracy', score: accuracy ? 50 : 0, maximumScore: 50, feedback: accuracy ? '定义和机制准确。' : '定义或机制仍需补学。' },
      { criterionId: 'evidence-boundary', score: boundary ? 50 : 0, maximumScore: 50, feedback: boundary ? '证据与限制写清。' : '尚未区分能证明与不能证明。' },
    ],
    score,
    passed: score === 100,
    reviewedAt: at,
    feedback: score === 100 ? '本次闭卷复测通过。' : '本次需要修订：返回课程概念段补学后重新提交。',
    supersedesId: existing?.id,
  }
  let next = addAssessment(props.evidenceState, assessment)
  if (score === 100) next = completeReviewTask(next, task.id, task.submissionAttemptId)
  emit('change', next)
  statusMessage.value = score === 100
    ? `${task.stage} 复测通过。${['D1', 'D3'].includes(task.stage) ? '该结果只证明短期间隔回忆，不满足 L3 的长期保持门槛。' : '该结果已成为跨日复测证据。'}`
    : `${task.stage} 复测需要修订，任务仍保持待审核状态；请返回 ${task.dayId} 补学、修改答案后再次审核。`
}

function revise(task: ReviewTask) {
  const response = responses[task.id]?.trim() ?? ''
  if (response.length < 60) {
    statusMessage.value = '修订版仍需至少 60 个有效字符，并同时覆盖定义、证据和限制。'
    return
  }
  const at = new Date().toISOString()
  const attempt: AttemptRecord = {
    id: makeEvidenceId('review-revision', task.id, at),
    dayId: task.dayId,
    activityId: `${task.id}-revision`,
    conceptIds: [task.conceptId],
    kind: 'spaced-retest',
    attemptedAt: at,
    passed: false,
    verification: 'self',
    evidence: response,
    reviewStage: task.stage,
    reviewTaskId: task.id,
    feedback: '修订版已提交，等待新的逐项量规审核。',
  }
  emit('change', resubmitReviewAttempt(props.evidenceState, task.id, attempt))
  accuracyChecks[task.id] = false
  boundaryChecks[task.id] = false
  statusMessage.value = `${task.stage} 修订版已保存；旧提交和旧审核仍保留在历史账本中。`
}
</script>

<template>
  <section class="v2-review-workbench" aria-labelledby="v2-review-title">
    <header>
      <div>
        <h2 id="v2-review-title">真实复测执行台</h2>
        <p>先闭卷提交，再逐项审核。重读、完成按钮和自信评价都不能完成复测任务。</p>
      </div>
      <span>{{ dueTasks.length }} 项到期或待审核</span>
    </header>

    <p v-if="statusMessage" class="review-status" role="status" aria-live="polite">{{ statusMessage }}</p>

    <div v-if="!dueTasks.length" class="review-empty">
      <strong>当前没有到期的 v2 复测</strong>
      <p>完成独立变式后，系统会按照 D1、D3、D7、D14、D30 和 D60 排程。</p>
    </div>

    <article v-for="task in pendingTasks" :key="task.id" class="v2-review-task">
      <div class="review-task-meta">
        <strong>{{ task.stage }}</strong>
        <span>{{ task.dueOn }}</span>
      </div>
      <div class="review-task-body">
        <h3>{{ conceptLabel(task) }} <small>{{ task.dayId }}</small></h3>
        <p>{{ promptFor(task) }}</p>
        <label>
          <span>闭卷答案</span>
          <textarea v-model="responses[task.id]" rows="5" placeholder="不要翻回课程；写出定义、机制、证据和限制。"></textarea>
        </label>
        <div class="review-task-actions">
          <button type="button" class="primary-action" @click="submit(task)">提交本次复测</button>
          <button type="button" class="secondary-action" @click="emit('openDay', task.dayId)">返回 {{ task.dayId }} 补学</button>
        </div>
      </div>
    </article>

    <article v-for="task in submittedTasks" :key="task.id" class="v2-review-task submitted">
      <div class="review-task-meta">
        <strong>{{ task.stage }}</strong>
        <span>待审核</span>
      </div>
      <div class="review-task-body">
        <h3>{{ conceptLabel(task) }} <small>{{ task.dayId }}</small></h3>
        <blockquote>{{ evidenceState.attempts.find((attempt) => attempt.id === task.submissionAttemptId)?.evidence }}</blockquote>
        <label>
          <span>修订版（需要修改时填写）</span>
          <textarea v-model="responses[task.id]" rows="4" placeholder="补学后重新闭卷作答；提交后会保留旧版本并切换到新的审核对象。"></textarea>
        </label>
        <button type="button" class="secondary-action revision-action" @click="revise(task)">提交修订版</button>
        <fieldset>
          <legend>逐项量规</legend>
          <label><input v-model="accuracyChecks[task.id]" type="checkbox">定义、机制和示例准确，没有把相似概念混为一谈。</label>
          <label><input v-model="boundaryChecks[task.id]" type="checkbox">写出了可观察证据，并明确说明证据不能证明什么。</label>
        </fieldset>
        <div class="review-task-actions">
          <button type="button" class="primary-action" @click="assess(task)">保存审核结论</button>
          <button type="button" class="secondary-action" @click="emit('openDay', task.dayId)">对照课程补学</button>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.v2-review-workbench { margin-bottom: 42px; }
.v2-review-workbench > header { display: flex; align-items: start; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line-strong); }
.v2-review-workbench h2 { margin: 0 0 7px; font-size: 28px; }
.v2-review-workbench header p { max-width: 65ch; margin: 0; color: var(--ink-soft); line-height: 1.7; }
.v2-review-workbench header > span { flex: 0 0 auto; padding: 7px 10px; color: var(--navy); background: var(--blue-pale); border-radius: 7px; font-size: 12px; font-weight: 760; }
.review-status { padding: 13px 15px; color: var(--navy); background: var(--blue-pale); border-radius: 8px; line-height: 1.65; }
.review-empty { padding: 24px 0; border-bottom: 1px solid var(--line); }
.review-empty p { margin: 7px 0 0; color: var(--ink-soft); }
.v2-review-task { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 24px; padding: 26px 0; border-bottom: 1px solid var(--line); }
.review-task-meta { display: grid; align-content: start; gap: 6px; }
.review-task-meta strong { color: var(--orange-deep); font-family: var(--mono); font-size: 19px; }
.review-task-meta span { color: var(--ink-faint); font-family: var(--mono); font-size: 12px; }
.review-task-body { min-width: 0; }
.review-task-body h3 { margin: 0; font-size: 20px; }
.review-task-body h3 small { color: var(--ink-faint); font-family: var(--mono); font-size: 12px; }
.review-task-body > p { max-width: 68ch; color: var(--ink-soft); line-height: 1.75; }
.review-task-body label > span { display: block; margin-bottom: 7px; color: var(--navy); font-weight: 760; }
.review-task-body textarea { width: 100%; min-height: 128px; font-size: 16px; line-height: 1.7; resize: vertical; }
.review-task-body blockquote { margin: 18px 0; padding: 17px 19px; color: var(--ink); background: var(--surface); border-radius: 9px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
.revision-action { margin: 10px 0 18px; }
.review-task-body fieldset { display: grid; gap: 12px; margin: 0; padding: 18px; border: 1px solid var(--line); border-radius: 9px; }
.review-task-body legend { padding: 0 7px; color: var(--navy); font-weight: 780; }
.review-task-body fieldset label { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; align-items: start; color: var(--ink-soft); line-height: 1.65; }
.review-task-body fieldset input { margin-top: 5px; }
.review-task-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 17px; }
@media (max-width: 620px) {
  .v2-review-workbench > header { flex-direction: column; }
  .v2-review-task { grid-template-columns: 1fr; gap: 12px; }
  .review-task-meta { grid-template-columns: auto 1fr; align-items: center; }
  .review-task-actions { flex-direction: column; }
}
</style>
