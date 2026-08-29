import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW5D3FrameworkPlan } from '../src/course/w5d3Framework.ts'
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

const lesson = getDailyCourse('W5D3')
const plan = getW5D3FrameworkPlan('W5D3')
const implementation = getDayImplementation('W5D3')

assert.ok(lesson && plan && implementation, 'W5D3 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W5D3 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W5D3').status, 'available', 'W5D3 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W5D3').access.requiresPriorDayCompletion, false, 'W5D3 不得依赖前一课完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W5D3 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w5d3')
assert.equal(implementation.experimentAdapter.key, 'multi-table-sql-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w5d3-evidence-v2')

const inspection = inspectDailyCourseImplementation('W5D3', lesson)
assert.equal(inspection.resolved, true, 'W5D3 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W5D3 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '连接用户、行为与订单', 'W5D3 正式主题必须是 连接用户、行为与订单')
assert.equal(lesson.deliverable.title, '多表 SQL 记录', 'W5D3 正式成果必须是 多表 SQL 记录')
assert.equal(lesson.nextLesson?.id, 'W5D4', 'W5D3 只能把下一步说明到 W5D4，不创建或替代 W5D4')
assert.equal(lesson.contentVersion, 'w5d3-multi-table-sql-day01-v1', 'W5D3 内容版本必须标记多表 SQL Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W5D3 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'source-table-map',
  'join-chain-grain',
  'step-row-count-audit',
  'step-unique-key-audit',
  'step-amount-audit',
  'null-link-gap-audit',
  'exercise-boundary',
  'multi-table-sql-log',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W5D3 首教概念必须精确匹配多表 SQL 主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'step_id',
  'source_sql_ref',
  'left_table',
  'right_table',
  'join_type',
  'join_key',
  'rows_before',
  'rows_after',
  'unique_keys',
  'amount_before',
  'amount_after',
  'gap_note',
  'can_prove',
  'cannot_prove',
  'next_sql_task',
  'multi-table-sql-log.md',
  'W5D3',
  'setup.sql',
  'exercises.sql',
  'answers.sql',
  'users',
  'events',
  'orders',
  '不能证明',
  'W5D4',
]) assert.ok(serialized.includes(phrase), 'W5D3 缺少多表 SQL 主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['真实生产结论已经证明', '看板已经可发布', '归因已经完成', 'W5D3 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W5D3 不得在合格内容中越界声明：' + forbidden)
}

const pageSource = read('../src/views/W5D3Page.vue')
const viewSource = read('../src/components/W5D3Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W5D3 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /multi-table-sql-observer-day01-v1|W5-多表SQL/, '多表 SQL 观察器必须覆盖本课主题')
assert.ok(viewSource.includes('multi-table-sql-log.md'), '成果必须机械校验多表 SQL 记录')
assert.ok(viewSource.includes('多表 SQL 记录'), '成果必须展示多表 SQL 记录标题')
assert.ok(viewSource.includes('deliverableGate.valid') && viewSource.includes("saveAttempt('deliverable')"), '成果只有通过多表 SQL 门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.doesNotMatch(viewSource, /W9D3|clean_orders|quality_report|orders_dirty\.csv/, 'W5D3 组件不得残留其他课程语义')

const attemptBase = {
  dayId: 'W5D3',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '多表 SQL 六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w5d3-guided-1', attemptedAt: '2026-08-27T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w5d3-guided-2', attemptedAt: '2026-08-27T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W5D3 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W5D3', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-27T13:00:00.000Z', sourceAttemptId: 'w5d3-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 32, 'W5D3 完成后内容注册表至少应为 32/72')
assert.ok(!inventory.missing.includes('W5D3'), 'inventory 不得继续把 W5D3 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
