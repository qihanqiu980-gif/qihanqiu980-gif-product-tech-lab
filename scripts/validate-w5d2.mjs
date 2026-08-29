import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW5D2FrameworkPlan } from '../src/course/w5d2Framework.ts'
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

const lesson = getDailyCourse('W5D2')
const plan = getW5D2FrameworkPlan('W5D2')
const implementation = getDayImplementation('W5D2')

assert.ok(lesson && plan && implementation, 'W5D2 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W5D2 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W5D2').status, 'available', 'W5D2 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W5D2').access.requiresPriorDayCompletion, false, 'W5D2 不得依赖前一课完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W5D2 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w5d2')
assert.equal(implementation.experimentAdapter.key, 'join-preserve-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w5d2-evidence-v2')

const inspection = inspectDailyCourseImplementation('W5D2', lesson)
assert.equal(inspection.resolved, true, 'W5D2 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W5D2 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '四种 JOIN 保留规则', 'W5D2 正式主题必须是 四种 JOIN 保留规则')
assert.equal(lesson.deliverable.title, 'JOIN 对账记录', 'W5D2 正式成果必须是 JOIN 对账记录')
assert.equal(lesson.nextLesson?.id, 'W5D3', 'W5D2 只能把下一步说明到 W5D3，不创建或替代 W5D3')
assert.equal(lesson.contentVersion, 'w5d2-join-contrast-day01-v2', 'W5D2 内容版本必须标记 JOIN 对照 Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W5D2 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'join-key-matching',
  'join-preserve-rule',
  'inner-join-filter',
  'left-join-preserve-left',
  'right-join-preserve-right',
  'full-join-preserve-both',
  'join-grain-amplification',
  'anti-join-gap-audit',
  'join-audit-map',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W5D2 首教概念必须精确匹配 JOIN 对账主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖九个首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'join_case_id',
  'left_table',
  'right_table',
  'join_type',
  'preserve_rule',
  'join_key',
  'rows_before',
  'rows_after',
  'unique_keys',
  'unmatched_keys',
  'amount_gap',
  'can_prove',
  'cannot_prove',
  'next_sql_task',
  'reconciliation.md',
  'JOIN 对账记录',
  'W5-JOIN对账',
  'JOIN 对照图',
  'LEFT JOIN',
  'FULL JOIN',
  'O05',
  'I08',
  '440',
  '740',
  '先聚合再连接',
  '不能证明',
  'W5D3',
]) assert.ok(serialized.includes(phrase), 'W5D2 缺少 JOIN 对账主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['真实生产 JOIN 已经证明', '看板已经可发布', '归因已经完成', 'W5D3 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W5D2 不得在合格内容中越界声明：' + forbidden)
}

const pageSource = read('../src/views/W5D2Page.vue')
const viewSource = read('../src/components/W5D2Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W5D2 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /join-preserve-observer-day01-v1|W5-JOIN对账/, 'JOIN 对账观察器必须覆盖本课主题')
assert.match(viewSource, /JOIN 对账记录[\s\S]*?join_case_id[\s\S]*?left_table[\s\S]*?right_table[\s\S]*?join_type[\s\S]*?preserve_rule[\s\S]*?join_key[\s\S]*?rows_before[\s\S]*?rows_after[\s\S]*?unique_keys[\s\S]*?unmatched_keys[\s\S]*?amount_gap[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_sql_task/, '成果必须机械校验 JOIN 对账字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过 JOIN 对账门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.doesNotMatch(viewSource, /W9D3|clean_orders|quality_report|orders_dirty\.csv/, 'W5D2 组件不得残留 W9D3 订单清洗语义')

const attemptBase = {
  dayId: 'W5D2',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: 'JOIN 对账脚本六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w5d2-guided-1', attemptedAt: '2026-08-27T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w5d2-guided-2', attemptedAt: '2026-08-27T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W5D2 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W5D2', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-27T13:00:00.000Z', sourceAttemptId: 'w5d2-guided-2' })
assert.equal(state.reviewTasks.length, 54, '九个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 32, 'W5D2 完成后内容注册表至少应为 32/72')
assert.ok(!inventory.missing.includes('W5D2'), 'inventory 不得继续把 W5D2 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
