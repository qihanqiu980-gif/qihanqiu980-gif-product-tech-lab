import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW9D3FrameworkPlan } from '../src/course/w9d3Framework.ts'
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

const lesson = getDailyCourse('W9D3')
const plan = getW9D3FrameworkPlan('W9D3')
const implementation = getDayImplementation('W9D3')

assert.ok(lesson && plan && implementation, 'W9D3 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W9D3 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W9D3').status, 'available', 'W9D3 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W9D3').access.requiresPriorDayCompletion, false, 'W9D3 不得依赖前一课完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W9D3 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w9d3')
assert.equal(implementation.experimentAdapter.key, 'order-cleaning-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w9d3-evidence-v2')

const inspection = inspectDailyCourseImplementation('W9D3', lesson)
assert.equal(inspection.resolved, true, 'W9D3 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W9D3 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '清洗订单', 'W9D3 正式主题必须是 清洗订单')
assert.equal(lesson.deliverable.title, '清洗脚本', 'W9D3 正式成果必须是 清洗脚本')
assert.equal(lesson.nextLesson?.id, 'W9D4', 'W9D3 只能把下一步说明到 W9D4，不创建或替代 W9D4')
assert.equal(lesson.contentVersion, 'w9d3-pandas-clean-orders-day01-v1', 'W9D3 内容版本必须标记 pandas 清洗 Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W9D3 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'orders-data-contract',
  'data-quality-snapshot',
  'pandas-copy-and-coerce',
  'issue-flag-columns',
  'clean-vs-quarantine-split',
  'rule-impact-log',
  'reconciliation-check',
  'order-cleaning-script',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W9D3 首教概念必须精确匹配订单清洗主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'clean_orders.py',
  'script_id',
  'source_file',
  'quality_rules',
  'issue_flags',
  'clean_output',
  'quarantine_output',
  'rule_log',
  'reconciliation_summary',
  'can_prove',
  'cannot_prove',
  'next_step',
  'orders_dirty.csv',
  'orders_clean.csv',
  'orders_quarantine.csv',
  'quality_report.md',
  '输入契约',
  '质量六维',
  '问题标记',
  'clean/quarantine',
  '规则日志',
  '对账',
  'input-contract',
  'quality-snapshot',
  'type-coercion',
  'issue-flags',
  'split-and-log',
  'reconciliation',
  'qualified-clean-script',
  '教学模拟',
  '不能证明',
  'W9D4',
]) assert.ok(serialized.includes(phrase), 'W9D3 缺少订单清洗主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['真实生产已经证明', '生产数据已经完全正确', '规则无争议', '坏行已经删除']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W9D3 不得在合格内容中越界声明：' + forbidden)
}

const pageSource = read('../src/views/W9D3Page.vue')
const viewSource = read('../src/components/W9D3Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W9D3 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /input-contract[\s\S]*?quality-snapshot[\s\S]*?type-coercion[\s\S]*?issue-flags[\s\S]*?split-and-log[\s\S]*?reconciliation[\s\S]*?qualified-clean-script/, '订单清洗观察器必须覆盖六条路径')
assert.match(viewSource, /clean_orders\.py[\s\S]*?清洗脚本|清洗脚本[\s\S]*?clean_orders\.py/, '页面必须显式呈现课程标题或成果文件名')
assert.match(viewSource, /script_id[\s\S]*?source_file[\s\S]*?quality_rules[\s\S]*?issue_flags[\s\S]*?clean_output[\s\S]*?quarantine_output[\s\S]*?rule_log[\s\S]*?reconciliation_summary[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_step/, '成果必须机械校验订单清洗脚本字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过订单清洗脚本门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.doesNotMatch(viewSource, /W8D6|daily-summary-script|summary-input-contract|source-record-normalization/, 'W9D3 组件不得残留 W8D6 摘要脚本语义')

const attemptBase = {
  dayId: 'W9D3',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '订单清洗脚本六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w9d3-guided-1', attemptedAt: '2026-08-27T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w9d3-guided-2', attemptedAt: '2026-08-27T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W9D3 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W9D3', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-27T13:00:00.000Z', sourceAttemptId: 'w9d3-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 31, 'W9D3 完成后内容注册表至少应为 31/72')
assert.ok(!inventory.missing.includes('W9D3'), 'inventory 不得继续把 W9D3 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
