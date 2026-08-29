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

const lesson = getDailyCourse('W3D2')
const plan = getDay01FrameworkPlan('W3D2')
const implementation = getDayImplementation('W3D2')
assert.ok(lesson && plan && implementation, 'W3D2 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W3D2 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W3D2').status, 'available', 'W3D2 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W3D2').access.requiresPriorDayCompletion, false, 'W3D2 不得依赖 W3D1 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W3D2 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w3d2')
assert.equal(implementation.experimentAdapter.key, 'select-execution-order-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w3d2-evidence-v2')

assert.equal(lesson.title, 'SELECT 执行逻辑', 'W3D2 正式主题必须是 SELECT 执行逻辑')
assert.equal(lesson.deliverable.title, 'SQL 执行顺序图', 'W3D2 正式成果必须是 SQL 执行顺序图')
assert.equal(lesson.nextLesson?.id, 'W3D3', 'W3D2 只允许把下一步说明到 W3D3，不创建或替代 W3D3')
assert.equal(plan.chapters.length, 7, 'W3D2 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'sql-statement', 'select-clause', 'from-clause', 'where-gate',
  'order-by-stage', 'limit-stage', 'execution-order', 'result-boundary',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W3D2 首教概念必须精确匹配单表 SELECT 执行顺序主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const w3d1 = getDailyCourse('W3D1')
assert.ok(w3d1, 'W3D2 必须依赖已注册 W3D1')
assert.deepEqual(lesson.prerequisiteConceptIds.toSorted(), w3d1.concepts.map((concept) => concept.id).toSorted(), 'W3D2 前置必须精确绑定 W3D1 八个概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'sql-execution-order.md',
  'business_question',
  'base_table',
  'source_rows',
  'where_gate',
  'select_columns',
  'sort_rule',
  'limit_window',
  'execution_order',
  'observed_result',
  'can_prove',
  'cannot_prove',
  'next_sql_task',
  'missing-from',
  'where-before-source',
  'select-column-mismatch',
  'order-without-rule',
  'limit-overclaim',
  'qualified-select-order',
  'FROM',
  'WHERE',
  'SELECT',
  'ORDER BY',
  'LIMIT',
  '教学模拟',
  '不能证明',
  'W3D3',
]) assert.ok(serialized.includes(phrase), 'W3D2 缺少 SELECT 顺序主题、字段、实验路径或边界：' + phrase)

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
for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '当天收入已经算出', '真实生产订单已经证明', 'W3D3 已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W3D2 不得在合格内容中越界声明：' + forbidden)
}
for (const futureTopic of ['COUNT DISTINCT', 'SUM(', 'AVG(', 'INNER JOIN', 'LEFT JOIN']) {
  assert.ok(!safeSerialized.includes(futureTopic), 'W3D2 不得提前展开后续 SQL 主题：' + futureTopic)
}

const pageSource = read('../src/views/W3D2Page.vue')
const viewSource = read('../src/components/W3D2Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W3D2 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /missing-from[\s\S]*?where-before-source[\s\S]*?select-column-mismatch[\s\S]*?order-without-rule[\s\S]*?limit-overclaim[\s\S]*?qualified-select-order/, 'SELECT 顺序观察器必须覆盖六条专属路径')
assert.match(viewSource, /只读取本地 SQLite 教学表 orders，不调用真实数据库/, '实验必须明确本地教学模拟资源边界')
assert.match(viewSource, /validationFields[\s\S]*?business_question[\s\S]*?base_table[\s\S]*?source_rows[\s\S]*?where_gate[\s\S]*?select_columns[\s\S]*?sort_rule[\s\S]*?limit_window[\s\S]*?execution_order[\s\S]*?observed_result[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_sql_task/, '成果必须机械校验 SQL 执行顺序图 12 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过 SQL 执行顺序图门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.doesNotMatch(viewSource, /lab_root|source_package|working_copy|terminal_command|current_directory|database_file|setup_script|sqlite3_check|schema_preview|first_row_preview|safety_boundary|qualified-sqlite-environment/, 'W3D2 页面不得残留 W3D1 环境成果字段或路径')

const attemptBase = { dayId: 'W3D2', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: 'SELECT 顺序六路径教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w3d2-guided-1', attemptedAt: '2026-08-25T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w3d2-guided-2', attemptedAt: '2026-08-25T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W3D2 修订提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W3D2', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-25T13:00:00.000Z', sourceAttemptId: 'w3d2-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 19, 'W3D2 完成后 inventory 至少包含 W3D2 及此前已开放课程')
assert.ok(!inventory.missing.includes('W3D2'), 'inventory 不得继续把 W3D2 记为 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected }, null, 2))
