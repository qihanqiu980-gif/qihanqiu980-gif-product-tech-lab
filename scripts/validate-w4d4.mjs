import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW4D4FrameworkPlan } from '../src/course/w4d4Framework.ts'
import { getDailyCourse, getDailyCourseInventory } from '../src/course/registry.ts'
import { getDailyCourseRouteState } from '../src/course/dayRouteState.ts'
import {
  getDayImplementation,
  inspectDailyCourseImplementation,
  validateDailyCourseImplementation,
} from '../src/course/implementationRegistry.ts'
import { validateDailyCourse } from '../src/course/validateDailyCourse.ts'
import { addAttempt, createEvidenceState, scheduleReviewTasks } from '../src/evidenceStore.ts'

const resolve = (path) => fileURLToPath(new URL(path, import.meta.url))
const read = (path) => readFileSync(resolve(path), 'utf8')

const lesson = getDailyCourse('W4D4')
const plan = getW4D4FrameworkPlan('W4D4')
const implementation = getDayImplementation('W4D4')
assert.ok(lesson && plan && implementation, 'W4D4 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W4D4 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W4D4').status, 'available', 'W4D4 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W4D4').access.requiresPriorDayCompletion, false, 'W4D4 不得依赖 W4D3 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W4D4 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w4d4')
assert.equal(implementation.experimentAdapter.key, 'misleading-rise-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w4d4-evidence-v2')

const inspection = inspectDailyCourseImplementation('W4D4', lesson)
assert.equal(inspection.resolved, true, 'W4D4 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W4D4 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '三种上涨假象', 'W4D4 正式主题必须是 三种上涨假象')
assert.equal(lesson.deliverable.title, '上涨误导案例分析', 'W4D4 正式成果必须是 上涨误导案例分析')
assert.equal(lesson.nextLesson?.id, 'W4D5', 'W4D4 只允许把下一步说明到 W4D5，不创建或替代 W4D5')
assert.equal(lesson.contentVersion, 'w4d4-misleading-rise-day01-v1', 'W4D4 内容版本必须标记上涨审查 Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W4D4 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'rise-claim-audit',
  'denominator-shift-trap',
  'survivorship-bias-trap',
  'outlier-average-trap',
  'composition-mix-shift',
  'distribution-guard-check',
  'misleading-rise-case-table',
  'metric-rise-decision-boundary',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W4D4 首教概念必须精确匹配上涨审查主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const w4d3 = getDailyCourse('W4D3')
assert.ok(w4d3, 'W4D4 必须依赖已注册 W4D3')
for (const concept of w4d3.concepts.map((item) => item.id)) {
  assert.ok(lesson.prerequisiteConceptIds.includes(concept), 'W4D4 前置必须包含 W4D3 概念：' + concept)
}

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'misleading-rise-review.md',
  'case_id',
  'metric_name',
  'old_value',
  'new_value',
  'claimed_rise',
  'risk_type',
  'denominator_check',
  'survivor_check',
  'outlier_check',
  'guardrail_metric',
  'sample_check',
  'can_prove',
  'cannot_prove',
  'next_review_task',
  'denominator_shift',
  'survivorship_bias',
  'outlier_average',
  'composition_mix',
  'distribution_guard',
  'exposed_users',
  'checkout_users',
  'aov_amount',
  'median_amount',
  'max_amount',
  'O06',
  'W4D5',
  '不能证明',
  '教学模拟',
]) assert.ok(serialized.includes(phrase), 'W4D4 缺少上涨审查主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['真实生产增长已经证明', '真实生产指标已经正确', 'JOIN 已经完成', '看板已经可发布', 'W4D4 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W4D4 不得在合格内容中越界声明：' + forbidden)
}

const pageSource = read('../src/views/W4D4Page.vue')
const viewSource = read('../src/components/W4D4Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W4D4 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /denominator-shift[\s\S]*?survivorship-bias[\s\S]*?outlier-average[\s\S]*?composition-mix[\s\S]*?distribution-guard[\s\S]*?case-table/, '上涨审查观察器必须覆盖六条路径')
assert.match(viewSource, /misleading-rise-review\.md[\s\S]*?上涨误导案例分析|上涨误导案例分析[\s\S]*?misleading-rise-review\.md/, '页面必须显式呈现课程标题或成果文件名')
assert.match(viewSource, /case_id[\s\S]*?metric_name[\s\S]*?old_value[\s\S]*?new_value[\s\S]*?claimed_rise[\s\S]*?risk_type[\s\S]*?denominator_check[\s\S]*?survivor_check[\s\S]*?outlier_check[\s\S]*?guardrail_metric[\s\S]*?sample_check[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_review_task/, '成果必须机械校验上涨审查的 14 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过上涨审查门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')

const attemptBase = {
  dayId: 'W4D4',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '上涨审查六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w4d4-guided-1', attemptedAt: '2026-08-27T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w4d4-guided-2', attemptedAt: '2026-08-27T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W4D4 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W4D4', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-27T13:00:00.000Z', sourceAttemptId: 'w4d4-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 27, 'W4D4 完成后内容注册表至少应为 27/72')
assert.ok(!inventory.missing.includes('W4D4'), 'inventory 不得继续把 W4D4 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
