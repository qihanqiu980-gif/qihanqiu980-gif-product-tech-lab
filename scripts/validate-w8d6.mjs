import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW8D6FrameworkPlan } from '../src/course/w8d6Framework.ts'
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

const lesson = getDailyCourse('W8D6')
const plan = getW8D6FrameworkPlan('W8D6')
const implementation = getDayImplementation('W8D6')

assert.ok(lesson && plan && implementation, 'W8D6 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W8D6 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W8D6').status, 'available', 'W8D6 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W8D6').access.requiresPriorDayCompletion, false, 'W8D6 不得依赖 W8D5 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W8D6 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w8d6')
assert.equal(implementation.experimentAdapter.key, 'daily-summary-script-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w8d6-evidence-v2')

const inspection = inspectDailyCourseImplementation('W8D6', lesson)
assert.equal(inspection.resolved, true, 'W8D6 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W8D6 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '生成每日业务摘要', 'W8D6 正式主题必须是 生成每日业务摘要')
assert.equal(lesson.deliverable.title, '自动摘要脚本', 'W8D6 正式成果必须是 自动摘要脚本')
assert.equal(lesson.nextLesson?.id, 'W9D1', 'W8D6 只能把下一步说明到 W9D1，不创建或替代 W9D1')
assert.equal(lesson.contentVersion, 'w8d6-daily-summary-day01-v1', 'W8D6 内容版本必须标记自动摘要 Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W8D6 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'summary-input-contract',
  'source-record-normalization',
  'metric-snapshot-assembly',
  'text-template-assembly',
  'repeatable-run-command',
  'evidence-limit-boundary',
  'fallback-on-schema-mismatch',
  'daily-summary-script',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W8D6 首教概念必须精确匹配自动摘要主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'daily-summary-script.py',
  'script_id',
  'summary_id',
  'input_source',
  'cleaning_rule',
  'metric_snapshot',
  'summary_template',
  'output_target',
  'run_command',
  'run_log',
  'evidence_limit',
  'can_prove',
  'cannot_prove',
  'next_step',
  '输入契约',
  '源记录归一化',
  '指标快照',
  '文本模板',
  '重复运行命令',
  '证据边界',
  '格式不匹配',
  'input-contract',
  'normalization',
  'metric-snapshot',
  'template-assembly',
  'run-repeatability',
  'qualified-summary-script',
  '教学模拟',
  '不能证明',
  'W9D1',
]) assert.ok(serialized.includes(phrase), 'W8D6 缺少自动摘要主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['真实生产已经证明', '生产调度已经自动化', '真实业务已证明']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W8D6 不得在合格内容中越界声明：' + forbidden)
}

const pageSource = read('../src/views/W8D6Page.vue')
const viewSource = read('../src/components/W8D6Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W8D6 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /input-contract[\s\S]*?normalization[\s\S]*?metric-snapshot[\s\S]*?template-assembly[\s\S]*?run-repeatability[\s\S]*?qualified-summary-script/, '自动摘要观察器必须覆盖六条路径')
assert.match(viewSource, /daily-summary-script\.py[\s\S]*?自动摘要脚本|自动摘要脚本[\s\S]*?daily-summary-script\.py/, '页面必须显式呈现课程标题或成果文件名')
assert.match(viewSource, /script_id[\s\S]*?input_source[\s\S]*?cleaning_rule[\s\S]*?metric_snapshot[\s\S]*?summary_template[\s\S]*?output_target[\s\S]*?run_command[\s\S]*?run_log[\s\S]*?evidence_limit[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_step/, '成果必须机械校验自动摘要脚本字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过自动摘要脚本门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.doesNotMatch(viewSource, /W8D2|execution-flow-diagram|执行流程图/, 'W8D6 组件不得残留 W8D2 成果语义')

const attemptBase = {
  dayId: 'W8D6',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '自动摘要脚本六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w8d6-guided-1', attemptedAt: '2026-08-27T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w8d6-guided-2', attemptedAt: '2026-08-27T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W8D6 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W8D6', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-27T13:00:00.000Z', sourceAttemptId: 'w8d6-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 30, 'W8D6 完成后内容注册表至少应为 30/72')
assert.ok(!inventory.missing.includes('W8D6'), 'inventory 不得继续把 W8D6 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
