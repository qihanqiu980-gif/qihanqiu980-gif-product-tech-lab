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

const lesson = getDailyCourse('W3D6')
const plan = getDay01FrameworkPlan('W3D6')
const implementation = getDayImplementation('W3D6')
assert.ok(lesson && plan && implementation, 'W3D6 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W3D6 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W3D6').status, 'available', 'W3D6 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W3D6').access.requiresPriorDayCompletion, false, 'W3D6 不得依赖 W3D5 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W3D6 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w3d6')
assert.equal(implementation.experimentAdapter.key, 'business-query-set-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w3d6-evidence-v2')

assert.equal(lesson.title, '回答真实业务问题', 'W3D6 正式主题必须是 回答真实业务问题')
assert.equal(lesson.deliverable.title, '12 道业务查询集', 'W3D6 正式成果必须是 12 道业务查询集')
assert.equal(lesson.nextLesson?.id, 'W4D1', 'W3D6 只允许把下一步说明到 W4D1，不创建或替代 W4D1')
assert.equal(plan.chapters.length, 7, 'W3D6 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'business-query-set', 'query-contract-reuse', 'row-level-answer', 'quality-flagged-answer',
  'sql-file-organization', 'answer-log-boundary', 'stakeholder-handoff-note', 'weekly-sql-review',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W3D6 首教概念必须精确匹配业务查询集主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const prereqLessons = ['W3D1', 'W3D2', 'W3D3', 'W3D4', 'W3D5'].map((dayId) => getDailyCourse(dayId))
assert.ok(prereqLessons.every(Boolean), 'W3D6 必须依赖已注册 W3D1-W3D5')
assert.deepEqual(
  lesson.prerequisiteConceptIds.toSorted(),
  prereqLessons.flatMap((course) => course.concepts.map((concept) => concept.id)).toSorted(),
  'W3D6 前置必须精确绑定 W3D1-W3D5 概念',
)

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'business-query-set.sql',
  'business-query-log.md',
  'query_id',
  'business_question',
  'request_ref',
  'base_table',
  'sql_text',
  'expected_rows',
  'observed_result',
  'quality_flags',
  'can_prove',
  'cannot_prove',
  'handoff_note',
  'next_review_question',
  'BQ01',
  'BQ02',
  'BQ03',
  'BQ04',
  'BQ05',
  'BQ06',
  'BQ07',
  'BQ08',
  'BQ09',
  'BQ10',
  'BQ11',
  'BQ12',
  'bq01-paid-app-orders',
  'bq12-review-ready-app-paid',
  'orders',
  'status',
  'paid',
  'channel',
  'app',
  'paid_at >=',
  'paid_at <',
  'TEST1',
  'O1018',
  'NULL',
  '0 元',
  '业务问题',
  'SQL',
  '预期',
  '实际',
  '能证明',
  '不能证明',
  '教学模拟',
  'W4D1',
]) assert.ok(serialized.includes(phrase), 'W3D6 缺少业务查询集主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '真实生产订单已经证明', '指标已经正确', 'W4D1 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W3D6 不得在合格内容中越界声明：' + forbidden)
}
for (const futureTopic of ['COUNT DISTINCT', 'COUNT(', 'SUM(', 'AVG(', 'INNER JOIN', 'LEFT JOIN', 'HAVING']) {
  assert.ok(!safeSerialized.includes(futureTopic), 'W3D6 不得提前展开后续 SQL 主题：' + futureTopic)
}

const pageSource = read('../src/views/W3D6Page.vue')
const viewSource = read('../src/components/W3D6Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W3D6 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /businessQueryTasks[\s\S]*?bq01-paid-app-orders[\s\S]*?bq02-20260831-paid-orders[\s\S]*?bq03-boundary-after-midnight[\s\S]*?bq04-recent-paid-orders[\s\S]*?bq05-app-nonpaid-orders[\s\S]*?bq06-distinct-channel-values[\s\S]*?bq07-test-order-risk[\s\S]*?bq08-duplicate-order-risk[\s\S]*?bq09-amount-review-risk[\s\S]*?bq10-paid-time-alias[\s\S]*?bq11-null-user-risk[\s\S]*?bq12-review-ready-app-paid/, '业务查询练习台必须覆盖 BQ01-BQ12')
assert.match(viewSource, /业务问题[\s\S]*?SQL[\s\S]*?预期留下哪些行[\s\S]*?实际看到什么[\s\S]*?能证明什么[\s\S]*?不能证明什么/, '每道业务查询必须呈现问题、SQL、预期、实际和证据边界')
assert.match(viewSource, /TEST1[\s\S]*?O1018[\s\S]*?NULL[\s\S]*?0 元[\s\S]*?W4D1/, '页面必须显式覆盖质量风险与下一步边界')
assert.match(viewSource, /validationFields[\s\S]*?query_id[\s\S]*?business_question[\s\S]*?request_ref[\s\S]*?base_table[\s\S]*?sql_text[\s\S]*?expected_rows[\s\S]*?observed_result[\s\S]*?quality_flags[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?handoff_note[\s\S]*?next_review_question/, '成果必须机械校验业务查询集 12 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过业务查询集门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')

const attemptBase = { dayId: 'W3D6', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '业务查询十二道教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w3d6-guided-1', attemptedAt: '2026-08-26T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w3d6-guided-2', attemptedAt: '2026-08-26T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W3D6 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W3D6', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-26T13:00:00.000Z', sourceAttemptId: 'w3d6-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 24, 'W4D1 完成后内容注册表至少应为 24/72')
assert.ok(!inventory.missing.includes('W3D6'), 'inventory 不得继续把 W3D6 记为 missing')
assert.ok(!inventory.missing.includes('W4D1'), 'W4D1 完成后不应继续 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected }, null, 2))
