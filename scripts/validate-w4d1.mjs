import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW4D1FrameworkPlan } from '../src/course/w4d1Framework.ts'
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

const lesson = getDailyCourse('W4D1')
const plan = getW4D1FrameworkPlan('W4D1')
const implementation = getDayImplementation('W4D1')
assert.ok(lesson && plan && implementation, 'W4D1 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W4D1 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W4D1').status, 'available', 'W4D1 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W4D1').access.requiresPriorDayCompletion, false, 'W4D1 不得依赖 W4D0 或前一天完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W4D1 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w4d1')
assert.equal(implementation.experimentAdapter.key, 'metric-contract-table-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w4d1-evidence-v2')

const inspection = inspectDailyCourseImplementation('W4D1', lesson)
assert.equal(inspection.resolved, true, 'W4D1 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W4D1 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '指标不是一个数字', 'W4D1 正式主题必须是 指标不是一个数字')
assert.equal(lesson.deliverable.title, '指标口径表', 'W4D1 正式成果必须是 指标口径表')
assert.equal(lesson.nextLesson?.id, 'W4D2', 'W4D1 只允许把下一步说明到 W4D2，不创建或替代 W4D2')
assert.equal(lesson.contentVersion, 'w4d1-metric-contract-day01-v1', 'W4D1 内容版本必须标记 Day 01 框架升级')
assert.equal(plan.chapters.length, 7, 'W4D1 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'metric-decision-purpose', 'metric-signal', 'metric-numerator', 'metric-denominator',
  'metric-grain', 'metric-time-window', 'metric-exclusion-rule', 'metric-contract-table',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W4D1 首教概念必须精确匹配指标口径主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const w3Lessons = ['W3D1', 'W3D2', 'W3D3', 'W3D4', 'W3D5', 'W3D6'].map((dayId) => getDailyCourse(dayId))
assert.ok(w3Lessons.every(Boolean), 'W4D1 必须依赖已注册 W3D1-W3D6')
assert.deepEqual(
  lesson.prerequisiteConceptIds.toSorted(),
  w3Lessons.flatMap((course) => course.concepts.map((concept) => concept.id)).toSorted(),
  'W4D1 前置必须精确绑定 W3D1-W3D6 概念',
)

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'metric-contract-table.md',
  'metric_id',
  'decision_purpose',
  'signal',
  'numerator',
  'denominator',
  'grain',
  'time_window',
  'exclusion_rules',
  'quality_risks',
  'source_query_ref',
  'can_prove',
  'cannot_prove',
  'next_sql_task',
  'app_paid_order_count',
  'app_payment_conversion_rate',
  'W3D6',
  'BQ12',
  'TEST1',
  'O1018',
  'NULL',
  'O1014',
  '教学模拟',
  'W4D2',
]) assert.ok(serialized.includes(phrase), 'W4D1 缺少指标口径主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['聚合结果正确', '真实生产指标已经证明', '指标已经正确']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W4D1 不得在合格内容中越界声明：' + forbidden)
}
for (const futureTopic of ['SELECT COUNT(', 'SELECT SUM(', 'SELECT AVG(', 'INNER JOIN', 'LEFT JOIN', 'HAVING']) {
  assert.ok(!safeSerialized.includes(futureTopic), 'W4D1 不得提前展开后续 SQL 主题：' + futureTopic)
}

const pageSource = read('../src/views/W4D1Page.vue')
const viewSource = read('../src/components/W4D1Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W4D1 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /app_paid_order_count[\s\S]*?app_payment_conversion_rate[\s\S]*?metricTasks[\s\S]*?purpose-missing[\s\S]*?qualified-metric-contract/, '指标口径观察器必须覆盖全部路径和两条样例口径')
assert.match(viewSource, /指标不是一个数字[\s\S]*?metric-contract-table\.md/, '页面必须显式呈现课程标题和成果文件名')
assert.match(viewSource, /业务问题[\s\S]*?定义草稿[\s\S]*?预期[\s\S]*?实际看到[\s\S]*?能证明[\s\S]*?不能证明/, '每条指标口径路径必须呈现问题、定义、预期、实际和证据边界')
assert.match(viewSource, /validationFields[\s\S]*?metric_id[\s\S]*?decision_purpose[\s\S]*?signal[\s\S]*?numerator[\s\S]*?denominator[\s\S]*?grain[\s\S]*?time_window[\s\S]*?exclusion_rules[\s\S]*?quality_risks[\s\S]*?source_query_ref[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_sql_task/, '成果必须机械校验指标口径表 13 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过指标口径门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')

const attemptBase = {
  dayId: 'W4D1',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '指标口径六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w4d1-guided-1', attemptedAt: '2026-08-26T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w4d1-guided-2', attemptedAt: '2026-08-26T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W4D1 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W4D1', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-26T13:00:00.000Z', sourceAttemptId: 'w4d1-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 24, 'W4D1 完成后内容注册表至少应为 24/72')
assert.ok(!inventory.missing.includes('W4D1'), 'inventory 不得继续把 W4D1 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
