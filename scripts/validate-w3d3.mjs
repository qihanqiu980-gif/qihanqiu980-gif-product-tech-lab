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

const lesson = getDailyCourse('W3D3')
const plan = getDay01FrameworkPlan('W3D3')
const implementation = getDayImplementation('W3D3')
assert.ok(lesson && plan && implementation, 'W3D3 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W3D3 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W3D3').status, 'available', 'W3D3 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W3D3').access.requiresPriorDayCompletion, false, 'W3D3 不得依赖 W3D2 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W3D3 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w3d3')
assert.equal(implementation.experimentAdapter.key, 'basic-sql-query-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w3d3-evidence-v2')

assert.equal(lesson.title, '用户与订单基础查询', 'W3D3 正式主题必须是 用户与订单基础查询')
assert.equal(lesson.deliverable.title, '6 道基础查询', 'W3D3 正式成果必须是 6 道基础查询')
assert.equal(lesson.nextLesson?.id, 'W3D4', 'W3D3 只允许把下一步说明到 W3D4，不创建或替代 W3D4')
assert.equal(plan.chapters.length, 7, 'W3D3 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'query-question', 'where-condition', 'comparison-operator', 'text-value-filter',
  'date-range-boundary', 'order-direction', 'column-alias', 'distinct-result',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W3D3 首教概念必须精确匹配用户与订单基础查询主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const w3d1 = getDailyCourse('W3D1')
const w3d2 = getDailyCourse('W3D2')
assert.ok(w3d1 && w3d2, 'W3D3 必须依赖已注册 W3D1 与 W3D2')
assert.deepEqual(lesson.prerequisiteConceptIds.toSorted(), [...w3d1.concepts.map((concept) => concept.id), ...w3d2.concepts.map((concept) => concept.id)].toSorted(), 'W3D3 前置必须精确绑定 W3D1 环境概念与 W3D2 SELECT 顺序概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'basic-query-log.md',
  'basic-sql-queries.sql',
  'query_id',
  'business_question',
  'base_table',
  'selected_columns',
  'filter_condition',
  'date_boundary',
  'sort_rule',
  'alias_used',
  'distinct_rule',
  'sql_text',
  'observed_result',
  'can_prove',
  'cannot_prove',
  'self_check_result',
  'next_sql_task',
  'q1-paid-orders',
  'q2-app-channel-orders',
  'q3-orders-on-20260831',
  'q4-recent-paid-orders',
  'q5-paid-time-alias',
  'q6-distinct-channels',
  '业务问题',
  'SQL',
  '预期留下',
  '实际看到',
  'FROM',
  'WHERE',
  'SELECT',
  'ORDER BY',
  'AS',
  'DISTINCT',
  'self_check.sql',
  'answers.sql',
  '教学模拟',
  '不能证明',
  'W3D4',
]) assert.ok(serialized.includes(phrase), 'W3D3 缺少基础查询主题、字段、实验路径或边界：' + phrase)

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
for (const forbidden of ['GROUP BY 已经完成', 'JOIN 已经完成', '聚合结果正确', '当天收入已经算出', '真实生产订单已经证明', 'W3D4 已经完成', '数据质量诊断已经完成']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W3D3 不得在合格内容中越界声明：' + forbidden)
}
for (const futureTopic of ['COUNT DISTINCT', 'COUNT(', 'SUM(', 'AVG(', 'INNER JOIN', 'LEFT JOIN', 'HAVING']) {
  assert.ok(!safeSerialized.includes(futureTopic), 'W3D3 不得提前展开后续 SQL 主题：' + futureTopic)
}

const pageSource = read('../src/views/W3D3Page.vue')
const viewSource = read('../src/components/W3D3Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W3D3 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /order_id[\s\S]*?user_id[\s\S]*?status[\s\S]*?channel[\s\S]*?paid_at/, '第 1 章必须展示 orders 表字段作为学习入口')
assert.match(viewSource, /O1001[\s\S]*?O1002[\s\S]*?O1003[\s\S]*?O1004[\s\S]*?O1005[\s\S]*?O1006/, '第 1 章必须展示 orders 表 5-8 行样本行')
assert.match(viewSource, /firstCompleteQuery[\s\S]*?status = "paid"[\s\S]*?paid_at >= "2026-08-31"[\s\S]*?paid_at < "2026-09-01"[\s\S]*?ORDER BY paid_at DESC[\s\S]*?不能证明真实生产收入/, '第 1 章必须先跑一条完整查询再拆概念')
assert.match(viewSource, /q1-paid-orders[\s\S]*?q2-app-channel-orders[\s\S]*?q3-orders-on-20260831[\s\S]*?q4-recent-paid-orders[\s\S]*?q5-paid-time-alias[\s\S]*?q6-distinct-channels/, '基础查询观察器必须覆盖 Q1-Q6 正向查询')
assert.match(viewSource, /业务问题[\s\S]*?SQL[\s\S]*?预期留下哪些行[\s\S]*?实际看到什么[\s\S]*?能证明什么[\s\S]*?不能证明什么/, '每道基础查询必须呈现问题、SQL、预期、实际和证据边界')
assert.match(viewSource, /q3-orders-on-20260831[\s\S]*?status = "paid"[\s\S]*?paid_at >= "2026-08-31"[\s\S]*?paid_at < "2026-09-01"/, 'Q3 必须是 2026-08-31 当天支付订单，不只是日期窗口')
assert.match(viewSource, /deliverableHint[\s\S]*?本题生成字段[\s\S]*?Q1-Q6 每题完成后该补哪些成果字段/, '成果表单必须随 Q1-Q6 逐题示范字段填写')
assert.match(viewSource, /不要先面对整张验收清单[\s\S]*?逐题记录字段/, '成果表单必须降低字段清单前置压力')
assert.match(viewSource, /只读取本地 SQLite 教学表 orders，不调用真实数据库/, '实验必须明确本地教学模拟资源边界')
assert.match(viewSource, /validationFields[\s\S]*?query_id[\s\S]*?business_question[\s\S]*?base_table[\s\S]*?selected_columns[\s\S]*?filter_condition[\s\S]*?date_boundary[\s\S]*?sort_rule[\s\S]*?alias_used[\s\S]*?distinct_rule[\s\S]*?sql_text[\s\S]*?observed_result[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?self_check_result[\s\S]*?next_sql_task/, '成果必须机械校验 6 道基础查询 15 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过 6 道基础查询门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.doesNotMatch(viewSource, /lab_root|source_package|working_copy|terminal_command|current_directory|database_file|setup_script|sqlite3_check|schema_preview|first_row_preview|safety_boundary|qualified-sqlite-environment/, 'W3D3 页面不得残留 W3D2 环境成果字段或路径')

const attemptBase = { dayId: 'W3D3', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '基础查询六道正向查询教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w3d3-guided-1', attemptedAt: '2026-08-25T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w3d3-guided-2', attemptedAt: '2026-08-25T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W3D3 修订提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W3D3', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-25T13:00:00.000Z', sourceAttemptId: 'w3d3-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 22, '当前内容注册表至少应包含 W3D3 及其前置课程')
assert.ok(!inventory.missing.includes('W3D3'), 'inventory 不得继续把 W3D3 记为 missing')
assert.ok(!inventory.missing.includes('W3D4'), 'inventory 不得继续把 W3D4 记为 missing')
assert.ok(!inventory.missing.includes('W3D5'), 'inventory 不得继续把 W3D5 记为 missing')
assert.equal(getDailyCourseRouteState('W3D6').status, 'available', 'W3D6 授权完成后应保持 available')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected }, null, 2))
