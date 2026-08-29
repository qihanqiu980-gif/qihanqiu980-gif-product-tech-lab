<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { listDailyCourses } from '../course/registry'
import {
  addAssessment,
  getAssessmentQueue,
  getEffectiveAssessment,
  makeEvidenceId,
  type AssessmentRecord,
  type AttemptKind,
  type AttemptRecord,
  type EvidenceState,
} from '../evidenceStore'

const props = defineProps<{
  evidenceState: EvidenceState
}>()

const emit = defineEmits<{
  change: [state: EvidenceState]
  openDay: [dayId: AttemptRecord['dayId']]
}>()

interface RubricCriterion {
  id: string
  label: string
  description: string
  weight: number
}

interface RubricDefinition {
  id: string
  title: string
  passScore: number
  criteria: readonly RubricCriterion[]
}

const rubricByKind: Record<Extract<AttemptKind, 'closed-book-explanation' | 'independent-variation' | 'work-product' | 'transfer'>, RubricDefinition> = {
  'closed-book-explanation': {
    id: 'closed-book-core-v1',
    title: '闭卷解释',
    passScore: 100,
    criteria: [
      { id: 'definition', label: '定义准确', description: '没有把对象与相似概念混为一谈。', weight: 25 },
      { id: 'mechanism', label: '机制完整', description: '说清输入、关键步骤与输出，而非只复述名词。', weight: 25 },
      { id: 'boundary', label: '职责边界', description: '明确它负责什么、不负责什么。', weight: 25 },
      { id: 'evidence', label: '证据有效', description: '指出可观察证据以及证据不能证明的内容。', weight: 25 },
    ],
  },
  'independent-variation': {
    id: 'independent-variation-v1',
    title: '独立变式',
    passScore: 100,
    criteria: [
      { id: 'changed-condition', label: '条件确实改变', description: '不是原样重复引导实验。', weight: 25 },
      { id: 'operation', label: '操作可复现', description: '计划、步骤和观察位置足够具体。', weight: 25 },
      { id: 'evidence', label: '证据与结论一致', description: '实际记录能够支持所写结论。', weight: 25 },
      { id: 'limitation', label: '限制写清', description: '说明当前证据仍不能证明什么。', weight: 25 },
    ],
  },
  'work-product': {
    id: 'daily-work-product-v1',
    title: '今日成果',
    passScore: 80,
    criteria: [
      { id: 'purpose', label: '问题与读者明确', description: '成果能让目标读者知道为何需要它。', weight: 20 },
      { id: 'facts', label: '事实字段完整', description: '关键字段有真实内容，不是保留占位符。', weight: 20 },
      { id: 'evidence', label: '证据来源可追溯', description: '关键判断能回到观察、实验或记录。', weight: 20 },
      { id: 'boundary', label: '结论边界清楚', description: '没有把局部证据夸大成系统事实。', weight: 20 },
      { id: 'actionable', label: '下一步可执行', description: '读者可以据此复现、评审或采取行动。', weight: 20 },
    ],
  },
  transfer: {
    id: 'work-transfer-v1',
    title: '工作迁移',
    passScore: 100,
    criteria: [
      { id: 'novelty', label: '场景真正不同', description: '新旧场景标识不同，且至少改变一个实质维度。', weight: 25 },
      { id: 'method', label: '方法可迁移', description: '能解释为何沿用或调整原方法。', weight: 25 },
      { id: 'evidence', label: '新证据有效', description: '结论来自新场景中的实际证据。', weight: 25 },
      { id: 'boundary', label: '迁移边界清楚', description: '写明哪些结论仍不能跨场景外推。', weight: 25 },
    ],
  },
}

const checks = reactive<Record<string, Record<string, boolean>>>({})
const notes = reactive<Record<string, string>>({})
const statusMessage = ref('')

const queue = computed(() => getAssessmentQueue(props.evidenceState))
const courseByDay = computed(() => new Map(listDailyCourses().map((lesson) => [lesson.id, lesson] as const)))
const conceptLabels = computed(() => new Map(
  listDailyCourses().flatMap((lesson) => lesson.concepts.map((concept) => [concept.id, concept.term] as const)),
))

function rubricFor(attempt: AttemptRecord): RubricDefinition {
  return rubricByKind[attempt.kind as keyof typeof rubricByKind]
}

function dayTitle(attempt: AttemptRecord) {
  return courseByDay.value.get(attempt.dayId)?.title ?? attempt.dayId
}

function conceptText(attempt: AttemptRecord) {
  return attempt.conceptIds.map((id) => conceptLabels.value.get(id) ?? id).join('、')
}

function existingAssessment(attempt: AttemptRecord) {
  return getEffectiveAssessment(props.evidenceState, attempt.id)
}

function transferContextValid(attempt: AttemptRecord) {
  if (attempt.kind !== 'transfer') return true
  const context = attempt.transferContext
  return Boolean(context && context.sourceScenarioId !== context.scenarioId && context.changedDimensions.length)
}

function evidenceText(attempt: AttemptRecord) {
  const raw = attempt.evidence?.trim() || '该提交没有保存可供审核的正文。'
  try {
    const parsed = JSON.parse(raw)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return raw
  }
}

function checked(attemptId: string, criterionId: string) {
  return checks[attemptId]?.[criterionId] === true
}

function setChecked(attemptId: string, criterionId: string, value: boolean) {
  checks[attemptId] ??= {}
  checks[attemptId][criterionId] = value
}

function assess(attempt: AttemptRecord) {
  const rubric = rubricFor(attempt)
  const score = rubric.criteria.reduce((total, criterion) => (
    total + (checked(attempt.id, criterion.id) ? criterion.weight : 0)
  ), 0)
  const contextValid = transferContextValid(attempt)
  const passed = contextValid && score >= rubric.passScore
  const at = new Date().toISOString()
  const previous = existingAssessment(attempt)
  const assessment: AssessmentRecord = {
    id: makeEvidenceId('assessment', attempt.id, at),
    attemptId: attempt.id,
    method: 'rubric',
    assessorRole: 'learner-with-rubric',
    rubricId: rubric.id,
    rubricVersion: '1',
    criteria: rubric.criteria.map((criterion) => ({
      criterionId: criterion.id,
      score: checked(attempt.id, criterion.id) ? criterion.weight : 0,
      maximumScore: criterion.weight,
      feedback: checked(attempt.id, criterion.id) ? `${criterion.label}：满足。` : `${criterion.label}：需要修订。`,
    })),
    score,
    passed,
    reviewedAt: at,
    feedback: notes[attempt.id]?.trim() || (passed
      ? `${rubric.title}通过当前量规。`
      : `${rubric.title}未通过；请返回 ${attempt.dayId} 修改正文并保存新版提交。`),
    supersedesId: previous?.id,
  }
  emit('change', addAssessment(props.evidenceState, assessment))
  statusMessage.value = passed
    ? `${attempt.dayId} 的${rubric.title}已通过；原始提交没有被改写。`
    : `${attempt.dayId} 的${rubric.title}得分 ${score}，仍需修订。旧提交和本次审核都会保留。`
}
</script>

<template>
  <section class="evidence-assessment-workbench" aria-labelledby="evidence-assessment-title">
    <header>
      <div>
        <p class="workbench-kicker">能力证据 · 量规审核</p>
        <h2 id="evidence-assessment-title">待审核证据工作台</h2>
        <p>提交只是原始证据。闭卷解释、独立变式、今日成果和工作迁移必须经过量规或他人审核，才可能进入掌握计算。</p>
      </div>
      <span>{{ queue.length }} 项待审核或修订</span>
    </header>

    <p v-if="statusMessage" class="assessment-status" role="status" aria-live="polite">{{ statusMessage }}</p>

    <div v-if="!queue.length" class="assessment-empty">
      <strong>当前没有待审核提交</strong>
      <p>完成日课中的闭卷解释、独立变式或成果草稿后，新提交会出现在这里。</p>
    </div>

    <article v-for="attempt in queue" :key="attempt.id" class="assessment-card">
      <div class="assessment-card-head">
        <div>
          <span>{{ attempt.dayId }} · {{ rubricFor(attempt).title }}</span>
          <h3>{{ dayTitle(attempt) }}</h3>
          <p>{{ conceptText(attempt) }}</p>
        </div>
        <div class="assessment-state">
          <strong>{{ existingAssessment(attempt) ? '已审未通过' : '首次待审' }}</strong>
          <small>{{ attempt.attemptedAt.slice(0, 16).replace('T', ' ') }}</small>
        </div>
      </div>

      <details class="submission-evidence">
        <summary>查看不可变原始提交</summary>
        <pre>{{ evidenceText(attempt) }}</pre>
        <dl v-if="attempt.kind === 'transfer' && attempt.transferContext">
          <div><dt>原场景</dt><dd>{{ attempt.transferContext.sourceScenarioId }}</dd></div>
          <div><dt>新场景</dt><dd>{{ attempt.transferContext.scenarioId }}</dd></div>
          <div><dt>变化维度</dt><dd>{{ attempt.transferContext.changedDimensions.join('、') }}</dd></div>
        </dl>
      </details>

      <p v-if="attempt.kind === 'transfer' && !transferContextValid(attempt)" class="context-error">
        当前迁移记录没有证明场景变化：新旧场景必须不同，并记录至少一个实质变化维度。请返回课程保存新版提交。
      </p>

      <fieldset :disabled="attempt.kind === 'transfer' && !transferContextValid(attempt)">
        <legend>{{ rubricFor(attempt).title }}量规 · {{ rubricFor(attempt).passScore }} 分通过</legend>
        <label v-for="criterion in rubricFor(attempt).criteria" :key="criterion.id">
          <input
            type="checkbox"
            :checked="checked(attempt.id, criterion.id)"
            @change="setChecked(attempt.id, criterion.id, ($event.target as HTMLInputElement).checked)"
          >
          <span><strong>{{ criterion.label }} · {{ criterion.weight }} 分</strong><small>{{ criterion.description }}</small></span>
        </label>
      </fieldset>

      <label class="assessment-note">
        <span>审核反馈（可选）</span>
        <textarea v-model="notes[attempt.id]" rows="3" placeholder="具体指出证据缺口或通过理由。"></textarea>
      </label>

      <div class="assessment-actions">
        <button type="button" class="secondary-action" @click="emit('openDay', attempt.dayId)">返回 {{ attempt.dayId }} 修订</button>
        <button
          type="button"
          class="primary-action"
          :disabled="attempt.kind === 'transfer' && !transferContextValid(attempt)"
          @click="assess(attempt)"
        >提交量规审核</button>
      </div>
    </article>
  </section>
</template>

<style scoped>
.evidence-assessment-workbench { margin-bottom: 46px; }
.evidence-assessment-workbench > header { display: flex; align-items: start; justify-content: space-between; gap: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line-strong); }
.workbench-kicker { margin: 0 0 7px; color: var(--orange-deep); font-family: var(--mono); font-size: 11px; font-weight: 780; letter-spacing: .08em; text-transform: uppercase; }
.evidence-assessment-workbench h2 { margin: 0 0 8px; font-size: 28px; }
.evidence-assessment-workbench header p:last-child { max-width: 70ch; margin: 0; color: var(--ink-soft); line-height: 1.7; }
.evidence-assessment-workbench header > span { flex: 0 0 auto; padding: 7px 10px; color: var(--navy); background: var(--blue-pale); border-radius: 7px; font-size: 12px; font-weight: 760; }
.assessment-status, .context-error { margin: 18px 0 0; padding: 12px 14px; border-radius: 7px; line-height: 1.65; }
.assessment-status { color: var(--navy); background: var(--blue-pale); border: 1px solid var(--line); }
.context-error { color: #7e2e28; background: #fff0ed; border: 1px solid #efc3bd; }
.assessment-empty { margin-top: 20px; padding: 22px; background: var(--surface); border: 1px solid var(--line); }
.assessment-empty p { margin: 6px 0 0; color: var(--ink-soft); }
.assessment-card { padding: 28px 0; border-bottom: 1px solid var(--line); }
.assessment-card-head { display: flex; align-items: start; justify-content: space-between; gap: 22px; }
.assessment-card-head span { color: var(--orange-deep); font-family: var(--mono); font-size: 12px; font-weight: 760; }
.assessment-card-head h3 { margin: 6px 0; font-size: 22px; }
.assessment-card-head p { margin: 0; color: var(--ink-soft); }
.assessment-state { flex: 0 0 auto; text-align: right; }
.assessment-state strong, .assessment-state small { display: block; }
.assessment-state strong { color: var(--navy); font-size: 12px; }
.assessment-state small { margin-top: 4px; color: var(--ink-faint); font-family: var(--mono); }
.submission-evidence { margin: 18px 0; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.submission-evidence summary { min-height: 46px; padding: 13px 15px; cursor: pointer; font-weight: 720; }
.submission-evidence pre { max-height: 320px; margin: 0; padding: 16px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; background: var(--paper-deep); border-top: 1px solid var(--line); font-size: 12px; line-height: 1.65; }
.submission-evidence dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 0; border-top: 1px solid var(--line); }
.submission-evidence dl div { min-width: 0; padding: 13px 15px; }
.submission-evidence dt { color: var(--ink-faint); font-size: 11px; }
.submission-evidence dd { margin: 5px 0 0; overflow-wrap: anywhere; }
.assessment-card fieldset { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 18px 0; padding: 0; border: 0; }
.assessment-card legend { grid-column: 1 / -1; width: 100%; margin-bottom: 10px; color: var(--ink); font-weight: 780; }
.assessment-card fieldset label { display: flex; gap: 11px; min-width: 0; padding: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.assessment-card fieldset input { flex: 0 0 auto; width: 18px; height: 18px; margin-top: 2px; }
.assessment-card fieldset span, .assessment-card fieldset small { display: block; }
.assessment-card fieldset small { margin-top: 4px; color: var(--ink-soft); line-height: 1.55; }
.assessment-note { display: block; margin-top: 16px; }
.assessment-note span { display: block; margin-bottom: 7px; font-weight: 720; }
.assessment-note textarea { width: 100%; resize: vertical; }
.assessment-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
@media (max-width: 680px) {
  .evidence-assessment-workbench > header, .assessment-card-head { flex-direction: column; }
  .assessment-state { text-align: left; }
  .assessment-card fieldset, .submission-evidence dl { grid-template-columns: 1fr; }
  .assessment-actions { align-items: stretch; flex-direction: column-reverse; }
  .assessment-actions button { width: 100%; }
}
</style>
