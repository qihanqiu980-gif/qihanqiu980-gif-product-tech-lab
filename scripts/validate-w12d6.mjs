import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { getDay01FrameworkPlan } from '../src/course/day01Framework.ts'
import { getDailyCourse, getDailyCourseInventory } from '../src/course/registry.ts'
import { getDailyCourseRouteState } from '../src/course/dayRouteState.ts'
import { getDayImplementation } from '../src/course/implementationRegistry.ts'
import { validateDailyCourse } from '../src/course/validateDailyCourse.ts'
import { addAttempt, createEvidenceState, scheduleReviewTasks } from '../src/evidenceStore.ts'

const resolve = (path) => fileURLToPath(new URL(path, import.meta.url))
const read = (path) => readFileSync(resolve(path), 'utf8')
const sha = (path) => createHash('sha256').update(readFileSync(resolve(path))).digest('hex')

const lesson = getDailyCourse('W12D6')
const plan = getDay01FrameworkPlan('W12D6')
const implementation = getDayImplementation('W12D6')
assert.ok(lesson && plan && implementation, 'W12D6 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W12D6 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W12D6').status, 'available', 'W12D6 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W12D6').access.requiresPriorDayCompletion, false, 'W12D6 不得依赖 W12D5 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W12D6 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w12d6')
assert.equal(implementation.experimentAdapter.key, 'portfolio-package-gate-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w12d6-evidence-v2')

assert.equal(lesson.title, '作品集装配、10 分钟答辩和复盘', 'W12D6 正式主题必须是作品集装配、10 分钟答辩和复盘')
assert.equal(lesson.deliverable.title, '完整作品集包', 'W12D6 正式成果必须是完整作品集包')
assert.equal(lesson.nextLesson, undefined, 'W12D6 是核心课程终点，不得定义 nextLesson')
assert.equal(plan.chapters.length, 7, 'W12D6 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7])
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须有四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须有三章')
for (const chapter of plan.chapters) {
  assert.ok(chapter.title.length >= 8 && chapter.lead.length >= 20, chapter.id + ' 缺少当天专属连续教材内容')
  assert.ok(chapter.practice.options.length >= 3 && chapter.retellRubric.length >= 3, chapter.id + ' 缺少练习或复述量规')
}

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), '七章框架漏掉语义字段 ' + section)
const requiredConcepts = [
  'portfolio-artifact-index', 'portfolio-evidence-thread', 'portfolio-storyline',
  'portfolio-ten-minute-pitch', 'portfolio-demo-boundary', 'portfolio-reviewer-qna',
  'portfolio-retrospective-insight', 'portfolio-redaction-evidence-limit',
]
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.toSorted(), 'W12D6 首教概念必须精确匹配作品集装配主题')
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'portfolio-checklist.md', 'portfolio_id', 'artifact_index', 'problem_story', 'solution_summary', 'evidence_thread',
  'risk_review_summary', 'revision_log', 'ten_minute_pitch', 'demo_boundary', 'reviewer_qna',
  'retrospective_insight', 'redaction_boundary', 'evidence_limit',
  'artifact-missing', 'evidence-thread-broken', 'pitch-too-long', 'demo-boundary-missing', 'qna-unprepared', 'qualified-portfolio-package',
  '教学模拟', '不能证明', 'W12D1', 'W12D2', 'W12D3', 'W12D4', 'W12D5', 'W13D1',
]) assert.ok(serialized.includes(phrase), 'W12D6 缺少作品集主题、字段、实验路径或终点边界：' + phrase)

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
for (const forbidden of ['真实上线已完成', '真实业务价值已证明', '真实答辩已通过', '招聘已成功', '录用已确定', 'W13D1 继续']) {
  assert.ok(!safeSerialized.includes(forbidden), 'W12D6 不得在合格内容中越界声明：' + forbidden)
}
assert.ok(lesson.deliverable.badExample.includes('W13D1') && lesson.deliverable.badReasons.some((reason) => reason.includes('W13D1')), 'W12D6 差稿可以包含 W13D1 作为反例，但必须明确指出问题')

assert.equal(lesson.learningPaths['30'].guidedStepIndices.length, 6, '30 分钟路径不得删除六条作品集装配路径')
assert.equal(lesson.learningPaths['45'].guidedStepIndices.length, 6, '45 分钟路径必须覆盖六条作品集装配路径')
assert.equal(lesson.exercises.length, 4, 'W12D6 必须有四道针对性练习')
assert.deepEqual(lesson.memory.reviewStages.map((item) => item.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])

const pageSource = read('../src/views/W12D6Page.vue')
const viewSource = read('../src/components/W12D6Day01CourseView.vue')
const shellCssSource = read('../src/components/W11D1Day01CourseView.css')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W12D6 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.ok((visibleTemplate.match(/class="w1-route-item"/g) ?? []).length >= 2, '移动目录与桌面目录必须由同一七章计划渲染')
for (const stateKey of ['learn', 'practicePassed', 'retellSubmitted']) {
  assert.equal((visibleTemplate.match(new RegExp("'is-done': evidence\\.frameworkChapters\\[chapter\\.id\\]\\." + stateKey, 'g')) ?? []).length, 2, '桌面与移动目录必须分别表达 ' + stateKey)
}
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /artifact-missing[\s\S]*?evidence-thread-broken[\s\S]*?pitch-too-long[\s\S]*?demo-boundary-missing[\s\S]*?qna-unprepared[\s\S]*?qualified-portfolio-package/, '作品集装配观察器必须覆盖六条专属路径')
assert.match(viewSource, /不调用真实模型、工具、账号、Token、公司数据或生产系统/, '实验必须明确本地教学模拟资源边界')
assert.match(viewSource, /validationFields[\s\S]*?portfolio_id[\s\S]*?artifact_index[\s\S]*?problem_story[\s\S]*?solution_summary[\s\S]*?evidence_thread[\s\S]*?risk_review_summary[\s\S]*?revision_log[\s\S]*?ten_minute_pitch[\s\S]*?demo_boundary[\s\S]*?reviewer_qna[\s\S]*?retrospective_insight[\s\S]*?redaction_boundary[\s\S]*?evidence_limit/, '成果必须机械校验 portfolio-checklist.md 13 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过完整作品集包门禁才可追加保存')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.match(shellCssSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面目录必须 sticky 且无内部纵向滚动')
assert.match(shellCssSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, '移动目录必须吸附在 appbar 下方')
assert.match(shellCssSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生第二条纵向滚动条')

const attemptBase = { dayId: 'W12D6', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '作品集装配六路径教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w12d6-guided-1', attemptedAt: '2026-08-25T12:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w12d6-guided-2', attemptedAt: '2026-08-25T13:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W12D6 修订提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W12D6', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-25T13:00:00.000Z', sourceAttemptId: 'w12d6-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')
for (const conceptId of lessonConceptIds) {
  assert.deepEqual(state.reviewTasks.filter((task) => task.conceptId === conceptId).map((task) => task.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])
}

const frozenHashes = {
  '../src/course/w12d5.ts': '0d4ce52e8871cde27e86523a85d1ed9ea6ec28e016b67ed4ff8ee57f5add3ffe',
  '../src/views/W12D5Page.vue': '1422c7378382df62aab9f99b090ab65f37d2a30f97c6162125a4dd54d1cba5e5',
  '../src/components/W12D5Day01CourseView.vue': 'b3da6badd20cda4bc42f90befa27d31608185c1585f8288fcda4c8aaf052227e',
  '../src/course/w12d4.ts': 'fc73cbf8c46c4d2a0bb5cb77cd340352c944ce109e8c0de868d5267497452a24',
  '../src/views/W12D4Page.vue': '7ae946d8ce14e46ec1e0d78e0deadbc9d03ad48f1aca1921ca9f6ab250c20b00',
  '../src/components/W12D4Day01CourseView.vue': '53bd8af26fbc15463e9c17f1447f47190f7e5757c145213aa3830344908ea887',
  '../src/course/w12d3.ts': '16d79e298b1674dfa6f71b49278c94370b80a05e3368db58e076e70225b743b4',
  '../src/views/W12D3Page.vue': 'ae41662da9e84584ea358f9b6c5a0a4dcd822f5f993c5385a0984880b475df3f',
  '../src/components/W12D3Day01CourseView.vue': '5f96488669a922b116fe8a3a8bb4aa1bc4395e53be6de92dd6c1c5f9a4143a94',
}
for (const [path, expected] of Object.entries(frozenHashes)) assert.equal(sha(path), expected, '冻结回归文件漂移：' + path)

for (const path of ['../src/course/w13d1.ts', '../src/views/W13D1Page.vue', '../src/components/W13D1Day01CourseView.vue', '../src/course/w12d7.ts', '../src/views/W12D7Page.vue', '../src/components/W12D7Day01CourseView.vue']) {
  assert.equal(existsSync(resolve(path)), false, '不得创建 W12D6 后续课程：' + path)
}
const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 17, 'W12D6 完成后 inventory 不得低于 17/72；后续单日插入允许增加库存')
assert.ok(!inventory.missing.includes('W12D6'), 'inventory 不得继续把 W12D6 记为 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, nextLesson: lesson.nextLesson ?? null, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected, frozenHashes: Object.keys(frozenHashes).length }, null, 2))
