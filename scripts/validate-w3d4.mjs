import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDay01FrameworkPlan } from '../src/course/day01Framework.ts'
import { getDailyCourse, getDailyCourseInventory } from '../src/course/registry.ts'
import { getDailyCourseRouteState } from '../src/course/dayRouteState.ts'
import { getDayImplementation } from '../src/course/implementationRegistry.ts'
import { validateDailyCourse } from '../src/course/validateDailyCourse.ts'
import { addAttempt, createEvidenceState, scheduleReviewTasks } from '../src/evidenceStore.ts'

const resolve = (path) => fileURLToPath(new URL(path, import.meta.url))
const read = (path) => readFileSync(resolve(path), 'utf8')

const lesson = getDailyCourse('W3D4')
const plan = getDay01FrameworkPlan('W3D4')
const implementation = getDayImplementation('W3D4')
assert.ok(lesson && plan && implementation, 'W3D4 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W3D4 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W3D4').status, 'available', 'W3D4 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W3D4').access.requiresPriorDayCompletion, false, 'W3D4 不得依赖 W3D3 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W3D4 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w3d4')
assert.equal(implementation.experimentAdapter.key, 'data-quality-check-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w3d4-evidence-v2')

assert.equal(lesson.title, '查询为何不可信', 'W3D4 正式主题必须是 查询为何不可信')
assert.equal(lesson.deliverable.title, '数据质量检查表', 'W3D4 正式成果必须是 数据质量检查表')
assert.equal(lesson.nextLesson?.id, 'W3D5', 'W3D4 只允许把下一步说明到 W3D5，不创建或替代 W3D5')
assert.equal(plan.chapters.length, 7, 'W3D4 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'quality-question', 'null-value', 'duplicate-row', 'status-coverage',
  'test-data-flag', 'time-boundary-risk', 'amount-anomaly', 'quality-evidence-boundary',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W3D4 首教概念必须精确匹配数据质量检查主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const w3d1 = getDailyCourse('W3D1')
const w3d2 = getDailyCourse('W3D2')
const w3d3 = getDailyCourse('W3D3')
assert.ok(w3d1 && w3d2 && w3d3, 'W3D4 必须依赖已注册 W3D1、W3D2 与 W3D3')
assert.deepEqual(lesson.prerequisiteConceptIds.toSorted(), [...w3d1.concepts.map((concept) => concept.id), ...w3d2.concepts.map((concept) => concept.id), ...w3d3.concepts.map((concept) => concept.id)].toSorted(), 'W3D4 前置必须精确绑定 W3D1/W3D2/W3D3 概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'data-quality-checklist.md',
  'check_id',
  'business_question',
  'suspect_field',
  'check_sql',
  'expected_risk',
  'observed_rows',
  'risk_type',
  'affected_query',
  'can_prove',
  'cannot_prove',
  'recommended_fix',
  'reviewer_note',
  'self_check_result',
  'next_sql_task',
  'null-user-id',
  'null-paid-at',
  'duplicate-order-id',
  'test-order-included',
  'zero-or-null-amount',
  'boundary-cross-day',
  'O1016',
  'O1017',
  'O1018',
  'TEST1',
  'O1014',
  '业务问题',
  'SQL',
  '预期风险',
  '实际看到',
  'FROM',
  'WHERE',
  'IS NULL',
  'self_check.sql',
  'answers.sql',
  '教学模拟',
  '不能证明',
  'W3D5',
]) assert.ok(serialized.includes(phrase), 'W3D4 缺少数据质量主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  plan,
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  exercises: lesson.exercises,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产订单已经证明', '真实生产指标已经错误', 'W3D5 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W3D4 不得在合格内容中越界声明：' + forbidden)
}
for (const futureTopic of ['COUNT(', 'SUM(', 'AVG(', 'INNER JOIN', 'LEFT JOIN', 'HAVING']) {
  assert.ok(!safeSerialized.includes(futureTopic), 'W3D4 不得提前展开后续 SQL 主题：' + futureTopic)
}

const pageSource = read('../src/views/W3D4Page.vue')
const viewSource = read('../src/components/W3D4Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W3D4 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /O1008[\s\S]*?TEST1[\s\S]*?O1014[\s\S]*?O1016[\s\S]*?O1017[\s\S]*?O1018/, '第 1 章必须展示 orders 表中的具体质量风险行')
assert.match(viewSource, /null-user-id[\s\S]*?null-paid-at[\s\S]*?duplicate-order-id[\s\S]*?test-order-included[\s\S]*?zero-or-null-amount[\s\S]*?boundary-cross-day/, '数据质量检查台必须覆盖 C1-C6')
assert.match(viewSource, /业务问题[\s\S]*?SQL[\s\S]*?预期留下哪些行[\s\S]*?实际看到什么[\s\S]*?能证明什么[\s\S]*?不能证明什么/, '每条质量检查必须呈现问题、SQL、预期、实际和证据边界')
assert.match(viewSource, /validationFields[\s\S]*?check_id[\s\S]*?business_question[\s\S]*?suspect_field[\s\S]*?check_sql[\s\S]*?expected_risk[\s\S]*?observed_rows[\s\S]*?risk_type[\s\S]*?affected_query[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?recommended_fix[\s\S]*?reviewer_note[\s\S]*?self_check_result[\s\S]*?next_sql_task/, '成果必须机械校验数据质量检查表 14 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过数据质量检查表门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')

const attemptBase = { dayId: 'W3D4', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '数据质量六条检查教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w3d4-guided-1', attemptedAt: '2026-08-25T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w3d4-guided-2', attemptedAt: '2026-08-25T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W3D4 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W3D4', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-25T13:00:00.000Z', sourceAttemptId: 'w3d4-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 24, 'W4D1 完成后内容注册表至少应为 24/72')
assert.ok(!inventory.missing.includes('W3D4'), 'inventory 不得继续把 W3D4 记为 missing')
assert.ok(!inventory.missing.includes('W3D5'), 'inventory 不得继续把 W3D5 记为 missing')
assert.equal(getDailyCourseRouteState('W3D6').status, 'available', 'W3D6 授权完成后应保持 available')
assert.ok(!inventory.missing.includes('W4D1'), 'W4D1 完成后不应继续 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected }, null, 2))
