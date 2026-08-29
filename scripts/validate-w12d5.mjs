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

const lesson = getDailyCourse('W12D5')
const plan = getDay01FrameworkPlan('W12D5')
const implementation = getDayImplementation('W12D5')
assert.ok(lesson && plan && implementation, 'W12D5 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W12D5 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W12D5').status, 'available', 'W12D5 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W12D5').access.requiresPriorDayCompletion, false, 'W12D5 不得依赖 W12D4 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W12D5 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w12d5')
assert.equal(implementation.experimentAdapter.key, 'review-notes-gate-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w12d5-evidence-v2')

assert.equal(lesson.title, '跨职能评审与修订', 'W12D5 正式主题必须是跨职能评审与修订')
assert.equal(lesson.deliverable.title, '评审纪要', 'W12D5 正式成果必须是评审纪要')
assert.equal(lesson.nextLesson?.id, 'W12D6', 'W12D5 只能声明下一课 W12D6，不得创建或替代其内容')
assert.equal(plan.chapters.length, 7, 'W12D5 主目录必须恰好七章')
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
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖八个首次教学概念')
assert.equal(lessonConceptIds.size, 8, 'W12D5 必须有八个独立首次教学概念')

const requiredConcepts = [
  'portfolio-review-role', 'portfolio-review-question', 'portfolio-review-evidence-response', 'portfolio-review-gap',
  'portfolio-review-decision', 'portfolio-review-revision-action', 'portfolio-review-owner-confirmation', 'portfolio-review-change-log',
]
assert.deepEqual([...lessonConceptIds].sort(), requiredConcepts.sort(), 'W12D5 首教概念必须精确匹配评审纪要主题')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  'review-notes.md', 'review_id', 'artifact_ref', 'review_role', 'question', 'evidence_cited', 'answer_summary',
  'gap_or_risk', 'decision', 'revision_action', 'owner', 'due_date', 'status', 'evidence_limit',
  'role-missing', 'question-vague', 'evidence-missing', 'decision-missing', 'revision-owner-missing', 'qualified-review-notes',
  '教学模拟', '不能证明', 'W12D4', 'W12D6',
]) assert.ok(serialized.includes(phrase), 'W12D5 缺少评审纪要主题、字段或实验边界：' + phrase)
for (const forbidden of ['作品集已完成', '答辩已通过', '真实系统已上线', '真实数据已接入', '生产稳定性已证明', '真实业务价值已证明', '真实跨职能已批准', '真实评审已通过', 'owner已承诺', '评审已通过', '上线已批准']) {
  assert.ok(!serialized.includes(forbidden), 'W12D5 不得提前教授 W12D6 或越界声明：' + forbidden)
}

assert.equal(lesson.learningPaths['30'].guidedStepIndices.length, 6, '30 分钟路径不得删除六条评审纪要路径')
assert.equal(lesson.learningPaths['45'].guidedStepIndices.length, 6, '45 分钟路径必须覆盖六条评审纪要路径')
assert.equal(lesson.exercises.length, 4, 'W12D5 必须有四道针对性练习')
assert.deepEqual(lesson.memory.reviewStages.map((item) => item.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])

const pageSource = read('../src/views/W12D5Page.vue')
const viewSource = read('../src/components/W12D5Day01CourseView.vue')
const shellCssSource = read('../src/components/W11D1Day01CourseView.css')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W12D5 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.ok((visibleTemplate.match(/class="w1-route-item"/g) ?? []).length >= 2, '移动目录与桌面目录必须由同一七章计划渲染')
for (const stateKey of ['learn', 'practicePassed', 'retellSubmitted']) {
  assert.equal((visibleTemplate.match(new RegExp("'is-done': evidence\\.frameworkChapters\\[chapter\\.id\\]\\." + stateKey, 'g')) ?? []).length, 2, '桌面与移动目录必须分别表达 ' + stateKey)
}
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /role-missing[\s\S]*?question-vague[\s\S]*?evidence-missing[\s\S]*?decision-missing[\s\S]*?revision-owner-missing[\s\S]*?qualified-review-notes/, '评审纪要观察器必须覆盖六条专属路径')
assert.match(viewSource, /不调用真实模型、工具、账号、Token、公司数据或生产系统/, '实验必须明确本地教学模拟资源边界')
assert.match(viewSource, /validationFields[\s\S]*?review_id[\s\S]*?artifact_ref[\s\S]*?review_role[\s\S]*?question[\s\S]*?evidence_cited[\s\S]*?answer_summary[\s\S]*?gap_or_risk[\s\S]*?decision[\s\S]*?revision_action[\s\S]*?owner[\s\S]*?due_date[\s\S]*?status[\s\S]*?evidence_limit/, '成果必须机械校验 review-notes.md 13 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过评审纪要门禁才可追加保存')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.match(shellCssSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面目录必须 sticky 且无内部纵向滚动')
assert.match(shellCssSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, '移动目录必须吸附在 appbar 下方')
assert.match(shellCssSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生第二条纵向滚动条')

const attemptBase = { dayId: 'W12D5', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '评审纪要六路径教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w12d5-guided-1', attemptedAt: '2026-08-25T10:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w12d5-guided-2', attemptedAt: '2026-08-25T11:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W12D5 修订提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W12D5', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-25T11:00:00.000Z', sourceAttemptId: 'w12d5-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')
for (const conceptId of lessonConceptIds) {
  assert.deepEqual(state.reviewTasks.filter((task) => task.conceptId === conceptId).map((task) => task.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])
}

const frozenHashes = {
  '../src/course/w12d4.ts': 'fc73cbf8c46c4d2a0bb5cb77cd340352c944ce109e8c0de868d5267497452a24',
  '../src/views/W12D4Page.vue': '7ae946d8ce14e46ec1e0d78e0deadbc9d03ad48f1aca1921ca9f6ab250c20b00',
  '../src/components/W12D4Day01CourseView.vue': '53bd8af26fbc15463e9c17f1447f47190f7e5757c145213aa3830344908ea887',
  '../src/course/w12d3.ts': '16d79e298b1674dfa6f71b49278c94370b80a05e3368db58e076e70225b743b4',
  '../src/views/W12D3Page.vue': 'ae41662da9e84584ea358f9b6c5a0a4dcd822f5f993c5385a0984880b475df3f',
  '../src/components/W12D3Day01CourseView.vue': '5f96488669a922b116fe8a3a8bb4aa1bc4395e53be6de92dd6c1c5f9a4143a94',
  '../src/course/w12d2.ts': '965279da069b457107a497299014a86f691d792063818c9e221900a5586dfa87',
  '../src/views/W12D2Page.vue': '6549ae286e286632003f54d967452a98bb589ecea74779cf344571d353f5040f',
  '../src/components/W12D2Day01CourseView.vue': 'd6d1afa1fbdf1d63fc162091fa768276b04c65fd9b3ea6c70e768cdb0de31bea',
}
for (const [path, expected] of Object.entries(frozenHashes)) assert.equal(sha(path), expected, '冻结回归文件漂移：' + path)

for (const path of ['../src/course/w13d1.ts', '../src/views/W13D1Page.vue', '../src/components/W13D1Day01CourseView.vue', '../src/course/w12d7.ts', '../src/views/W12D7Page.vue', '../src/components/W12D7Day01CourseView.vue']) {
  assert.equal(existsSync(resolve(path)), false, '不得创建 W12D6 后续课程：' + path)
}
const terminalLesson = getDailyCourse('W12D6')
if (terminalLesson) assert.equal(terminalLesson.nextLesson, undefined, 'W12D6 是核心课程终点，不得定义 nextLesson。')
const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 16, 'W12D5 完成后 inventory 至少为 16/72')
assert.ok(!inventory.missing.includes('W12D5'), 'inventory 不得继续把 W12D5 记为 missing')
if (inventory.available >= 17) assert.ok(!inventory.missing.includes('W12D6'), 'W12D6 可用后 inventory 不得继续把 W12D6 记为 missing')
else assert.ok(inventory.missing.includes('W12D6'), 'W12D6 未制作前 inventory 必须继续把 W12D6 记为 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected, frozenHashes: Object.keys(frozenHashes).length }, null, 2))
