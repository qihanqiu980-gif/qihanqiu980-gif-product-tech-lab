import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getW8D2FrameworkPlan } from '../src/course/w8d2Framework.ts'
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

const lesson = getDailyCourse('W8D2')
const plan = getW8D2FrameworkPlan('W8D2')
const implementation = getDayImplementation('W8D2')

assert.ok(lesson && plan && implementation, 'W8D2 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W8D2 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W8D2').status, 'available', 'W8D2 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W8D2').access.requiresPriorDayCompletion, false, 'W8D2 不得依赖 W8D1 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W8D2 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w8d2')
assert.equal(implementation.experimentAdapter.key, 'python-input-output-flow-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w8d2-evidence-v2')

const inspection = inspectDailyCourseImplementation('W8D2', lesson)
assert.equal(inspection.resolved, true, 'W8D2 的 renderer、实验和证据契约必须全部解析成功')
assert.deepEqual(inspection.issues, [])
assert.equal(validateDailyCourseImplementation(implementation, lesson).length, 0, 'W8D2 的实现契约必须与课程内容完全匹配')

assert.equal(lesson.title, '从输入到输出', 'W8D2 正式主题必须是 从输入到输出')
assert.equal(lesson.deliverable.title, '执行流程图', 'W8D2 正式成果必须是 执行流程图')
assert.equal(lesson.nextLesson?.id, 'W8D3', 'W8D2 只允许把下一步说明到 W8D3，不创建或替代 W8D3')
assert.equal(lesson.contentVersion, 'w8d2-input-output-flow-day01-v1', 'W8D2 内容版本必须标记输入到输出 Day 01 框架')
assert.equal(plan.chapters.length, 7, 'W8D2 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)

const requiredConcepts = [
  'script-input-contract',
  'raw-value-capture',
  'intermediate-state-flow',
  'transformation-step',
  'decision-path',
  'output-contract',
  'flow-trace',
  'execution-flow-diagram',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W8D2 首教概念必须精确匹配输入到输出主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'execution-flow-diagram.md',
  'flow_id',
  'input_source',
  'raw_value',
  'state_variable',
  'transform_step',
  'decision_path',
  'output_target',
  'can_prove',
  'cannot_prove',
  'next_step',
  '输入契约',
  '原始值',
  '变量接力',
  '转换步骤',
  '判断路径',
  '输出契约',
  'raw-input',
  'state-flow',
  'decision-path',
  'flow-trace',
  'output-target',
  'qualified-flow-map',
  '教学模拟',
  '不能证明',
  'W8D3',
]) assert.ok(serialized.includes(phrase), 'W8D2 缺少输入输出主题、字段、实验路径或边界：' + phrase)

const safeSerialized = JSON.stringify({
  demonstration: lesson.demonstration,
  guidedLab: lesson.guidedLab,
  independentLab: lesson.independentLab,
  fields: lesson.deliverable.fields,
  standardTemplate: lesson.deliverable.standardTemplate,
  goodExample: lesson.deliverable.goodExample,
  memory: lesson.memory,
})
for (const forbidden of ['JSON已完成', 'CSV已完成', '报错诊断已完成', '文件批处理已完成', '真实业务已证明']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W8D2 不得在合格内容中越界声明：' + forbidden)
}

const pageSource = read('../src/views/W8D2Page.vue')
const viewSource = read('../src/components/W8D2Day01CourseView.vue')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W8D2 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.match(viewSource, /raw-input[\s\S]*?state-flow[\s\S]*?decision-path[\s\S]*?flow-trace[\s\S]*?output-target[\s\S]*?qualified-flow-map/, '输入到输出观察器必须覆盖六条路径')
assert.match(viewSource, /execution-flow-diagram\.md[\s\S]*?执行流程图|执行流程图[\s\S]*?execution-flow-diagram\.md/, '页面必须显式呈现课程标题或成果文件名')
assert.match(viewSource, /flow_id[\s\S]*?input_source[\s\S]*?raw_value[\s\S]*?state_variable[\s\S]*?transform_step[\s\S]*?decision_path[\s\S]*?output_target[\s\S]*?can_prove[\s\S]*?cannot_prove[\s\S]*?next_step/, '成果必须机械校验执行流程图的 10 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过执行流程图门禁才可追加保存')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /assessChapterRetell[\s\S]*?retellAttempts[\s\S]*?>= 2[\s\S]*?buildRetellReferenceAnswer/, '复述必须先核验，第二次仍错才显示参考答案')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')

const attemptBase = {
  dayId: 'W8D2',
  activityId: 'daily-guided-lab',
  conceptIds: [...lessonConceptIds],
  kind: 'practical-operation',
  passed: true,
  verification: 'system',
  evidence: '执行流程图六条路径教学模拟证据',
}
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w8d2-guided-1', attemptedAt: '2026-08-27T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w8d2-guided-2', attemptedAt: '2026-08-27T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W8D2 提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W8D2', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-27T13:00:00.000Z', sourceAttemptId: 'w8d2-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')

const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 29, 'W8D2 完成后内容注册表至少应为 29/72')
assert.ok(!inventory.missing.includes('W8D2'), 'inventory 不得继续把 W8D2 记为 missing')

console.log(JSON.stringify({
  dayId: lesson.id,
  title: lesson.title,
  chapters: plan.chapters.length,
  concepts: lessonConceptIds.size,
  appendOnlyAttempts: state.attempts.length,
  reviewTasks: state.reviewTasks.length,
  inventory: inventory.available + '/' + inventory.expected,
}, null, 2))
