import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW4D2FrameworkPlan } from '../src/course/w4d2Framework.ts'
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

const lesson = getDailyCourse('W4D2')
const plan = getW4D2FrameworkPlan('W4D2')
const implementation = getDayImplementation('W4D2')
assert.ok(lesson && plan && implementation, 'W4D2 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W4D2 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W4D2').status, 'available', 'W4D2 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W4D2').access.requiresPriorDayCompletion, false, 'W4D2 不得依赖 W4D1 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W4D2 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w4d2')
assert.equal(implementation.experimentAdapter.key, 'aggregation-logic-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w4d2-evidence-v2')

const inspection = inspectDailyCourseImplementation('W4D2', lesson)
assert.equal(inspection.resolved, true, 'W4D2 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W4D2 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '聚合与分组入门', 'W4D2 正式主题必须是 聚合与分组入门')
assert.equal(lesson.deliverable.title, '聚合逻辑图', 'W4D2 正式成果必须是 聚合逻辑图')
assert.equal(lesson.nextLesson?.id, 'W4D3', 'W4D2 只允许把下一步说明到 W4D3，不创建或替代 W4D3')
assert.equal(lesson.contentVersion, 'w4d2-aggregation-logic-day01-v1', 'W4D2 内容版本必须标记聚合逻辑 Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W4D2 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'aggregation-input-set', 'count-aggregate', 'distinct-aggregate', 'sum-aggregate',
  'avg-aggregate', 'group-by-bucket', 'having-group-filter', 'aggregation-logic-map',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W4D2 首教概念必须精确匹配聚合逻辑主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const w4d1 = getDailyCourse('W4D1')
assert.ok(w4d1, 'W4D2 必须依赖已注册 W4D1')
for (const concept of w4d1.concepts.map((item) => item.id)) {
  assert.ok(lesson.prerequisiteConceptIds.includes(concept), 'W4D2 前置必须包含 W4D1 概念：' + concept)
}

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'aggregation-logic.md',
  'aggregation_id',
  'metric_ref',
  'business_question',
  'input_rows',
  'where_rule',
  'aggregate_function',
  'distinct_key',
  'group_key',
  'having_rule',
  'result_value',
  'edge_case',
  'can_prove',
  'cannot_prove',
  'next_sql_task',
  'COUNT',
  'DISTINCT',
  'SUM',
  'AVG',
  'GROUP BY',
  'HAVING',
  'exposed_users=10',
  'paid_same_day_users=4',
  'paid_within_24h_users=4',
  'unique_paid_orders=5',
  'average_amount=2077.00',
  'median_amount=89.00',
  'max_amount=9999.00',
  'U03',
  'O05',
  'O06',
  'TEST',
  '教学模拟',
  'W4D3',
]) assert.ok(serialized.includes(phrase), 'W4D2 缺少聚合主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['真实生产指标已经证明', '真实生产指标已经正确', 'JOIN 已经完成', '看板已经可发布', 'W4D3 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W4D2 不得在合格内容中越界声明：' + forbidden)
}
for (const futureTopic of ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN']) {
  assert.ok(!safeSerialized.includes(futureTopic), 'W4D2 不得提前展开 JOIN 主题：' + futureTopic)
}

const pageSource = read('../src/views/W4D2Page.vue')
const viewSource = read('../src/components/W4D2Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W4D2 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /exposed-users-count[\s\S]*?same-day-payment-rate[\s\S]*?rolling-24h-window[\s\S]*?unique-paid-orders[\s\S]*?average-vs-median[\s\S]*?group-having-gate/, '聚合观察器必须覆盖六条路径')
assert.match(viewSource, /聚合与分组入门[\s\S]*?aggregation-logic\.md|aggregation-logic\.md[\s\S]*?聚合逻辑图/, '页面必须显式呈现课程标题或成果文件名')
assert.match(viewSource, /业务问题[\s\S]*?定义草稿[\s\S]*?预期[\s\S]*?实际看到[\s\S]*?能证明[\s\S]*?不能证明/, '每条聚合路径必须呈现问题、定义、预期、实际和证据边界')
assert.match(viewSource, /validationFields[\s\S]*?aggregation_id[\s\S]*?metric_ref[\s\S]*?business_question[\s\S]*?input_rows[\s\S]*?where_rule[\s\S]*?aggregate_function[\s\S]*?distinct_key[\s\S]*?group_key[\s\S]*?having_rule[\s\S]*?result_value[\s\S]*?edge_case[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_sql_task/, '成果必须机械校验聚合逻辑图 14 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过聚合逻辑门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')

const attemptBase = {
  dayId: 'W4D2',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '聚合逻辑六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w4d2-guided-1', attemptedAt: '2026-08-26T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w4d2-guided-2', attemptedAt: '2026-08-26T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W4D2 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W4D2', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-26T13:00:00.000Z', sourceAttemptId: 'w4d2-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 25, 'W4D2 完成后内容注册表至少应为 25/72')
assert.ok(!inventory.missing.includes('W4D2'), 'inventory 不得继续把 W4D2 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
