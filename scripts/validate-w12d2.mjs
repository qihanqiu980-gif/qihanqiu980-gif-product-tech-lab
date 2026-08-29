import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
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

const lesson = getDailyCourse('W12D2')
const plan = getDay01FrameworkPlan('W12D2')
const implementation = getDayImplementation('W12D2')
assert.ok(lesson && plan && implementation, 'W12D2 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W12D2 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W12D2').status, 'available', 'W12D2 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W12D2').access.requiresPriorDayCompletion, false, 'W12D2 不得依赖 W12D1 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W12D2 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w12d2')
assert.equal(implementation.experimentAdapter.key, 'system-data-plan-gate-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w12d2-evidence-v2')

assert.equal(lesson.title, '系统与数据方案', 'W12D2 正式主题必须是系统与数据方案')
assert.equal(lesson.deliverable.title, '系统与数据方案', 'W12D2 正式成果必须是系统与数据方案')
assert.equal(lesson.nextLesson?.id, 'W12D3', 'W12D2 只能声明下一课 W12D3，不得创建或替代其内容')
assert.equal(plan.chapters.length, 7, 'W12D2 主目录必须恰好七章')
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
assert.equal(lessonConceptIds.size, 8, 'W12D2 必须有八个独立首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  '系统边界', '用户旅程触点', '数据对象', '数据来源与责任', '输入输出契约', '状态生命周期', '集成依赖', '方案决策',
  'system-data-plan.md', 'brief_ref', 'system_goal', 'system_boundary', 'user_touchpoints', 'data_entities', 'data_sources',
  'input_output_contracts', 'state_lifecycle', 'dependencies', 'privacy_access_boundary', 'validation_questions', 'non_goals', 'evidence_limit',
  'boundary-missing', 'entity-missing', 'source-unknown', 'contract-missing', 'state-missing', 'qualified-plan',
  '教学模拟', '不能证明', 'W12D3',
]) assert.ok(serialized.includes(phrase), 'W12D2 缺少系统与数据方案主题、字段或实验边界：' + phrase)
for (const forbidden of ['验证日志已完成', '风险登记册已完成', '评审纪要已完成', '作品集已完成', '答辩已通过', '上线可行已证明']) {
  assert.ok(!serialized.includes(forbidden), 'W12D2 不得提前教授 W12D3+ 或越界声明：' + forbidden)
}
for (const label of ['真实系统已开发', '真实数据已接入']) {
  let index = serialized.indexOf(label)
  while (index !== -1) {
    const prefix = serialized.slice(Math.max(0, index - 30), index)
    assert.ok(prefix.includes('不能证明'), 'W12D2 不得提前教授 W12D3+ 或越界声明：' + label)
    index = serialized.indexOf(label, index + label.length)
  }
}

assert.equal(lesson.learningPaths['30'].guidedStepIndices.length, 6, '30 分钟路径不得删除六条系统与数据方案路径')
assert.equal(lesson.learningPaths['45'].guidedStepIndices.length, 6, '45 分钟路径必须覆盖六条系统与数据方案路径')
assert.equal(lesson.exercises.length, 4, 'W12D2 必须有四道针对性练习')
assert.deepEqual(lesson.memory.reviewStages.map((item) => item.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])

const pageSource = read('../src/views/W12D2Page.vue')
const viewSource = read('../src/components/W12D2Day01CourseView.vue')
const shellCssSource = read('../src/components/W11D1Day01CourseView.css')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W12D2 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.equal((visibleTemplate.match(/class="w1-route-item"/g) ?? []).length, 2, '移动目录与桌面目录必须由同一七章计划渲染')
for (const stateKey of ['learn', 'practicePassed', 'retellSubmitted']) {
  assert.equal((visibleTemplate.match(new RegExp("'is-done': evidence\\.frameworkChapters\\[chapter\\.id\\]\\." + stateKey, 'g')) ?? []).length, 2, '桌面与移动目录必须分别表达 ' + stateKey)
}
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /boundary-missing[\s\S]*?entity-missing[\s\S]*?source-unknown[\s\S]*?contract-missing[\s\S]*?state-missing[\s\S]*?qualified-plan/, '系统与数据方案观察器必须覆盖六条专属路径')
assert.match(viewSource, /不调用真实模型、工具、账号、Token、公司数据、生产日志或合规系统/, '实验必须明确本地教学模拟资源边界')
assert.match(viewSource, /planFields[\s\S]*?brief_ref[\s\S]*?system_boundary[\s\S]*?data_entities[\s\S]*?input_output_contracts[\s\S]*?state_lifecycle[\s\S]*?validation_questions[\s\S]*?evidence_limit/, '成果必须机械校验 system-data-plan.md 13 个字段')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过系统与数据方案门禁才可追加保存')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.match(shellCssSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面目录必须 sticky 且无内部纵向滚动')
assert.match(shellCssSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, '移动目录必须吸附在 appbar 下方')
assert.match(shellCssSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生第二条纵向滚动条')

const attemptBase = { dayId: 'W12D2', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '系统与数据方案六路径教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w12d2-guided-1', attemptedAt: '2026-08-23T16:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w12d2-guided-2', attemptedAt: '2026-08-23T17:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W12D2 修订提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W12D2', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-23T17:00:00.000Z', sourceAttemptId: 'w12d2-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')
for (const conceptId of lessonConceptIds) {
  assert.deepEqual(state.reviewTasks.filter((task) => task.conceptId === conceptId).map((task) => task.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])
}

const frozenHashes = {
  '../src/course/w12d1.ts': 'c57037b60d3403c88bc44ee334999e78c08e7f209365eccf95ed40c28478a3ab',
  '../src/views/W12D1Page.vue': 'bc60bd2d5bbc2e0a9ed6246cb90950437f1fd220ac37bad1c8f8eff6a55590d8',
  '../src/components/W12D1Day01CourseView.vue': '8c4b2a7708046d433d53cfe970b0c5946da2a818055ae026637af3a337a80a8f',
  '../src/course/w11d6.ts': '815a423bae18cdc5d8ab9d45a104bc994386eda2e42b7f841102f7de610cc71b',
  '../src/views/W11D6Page.vue': '7119b346e68b2d049d07d48e1f7d8127b14999f13765e1ff24313782057996eb',
  '../src/components/W11D6Day01CourseView.vue': '4585f30b83ef088cfbbc28b30ce4b0c5fcae02ee4e8417e25306946f9566f89a',
}
for (const [path, expected] of Object.entries(frozenHashes)) assert.equal(sha(path), expected, '冻结回归文件漂移：' + path)

for (const path of ['../src/course/w13d1.ts', '../src/views/W13D1Page.vue', '../src/components/W13D1Day01CourseView.vue', '../src/course/w12d7.ts', '../src/views/W12D7Page.vue', '../src/components/W12D7Day01CourseView.vue']) {
  assert.equal(existsSync(resolve(path)), false, '不得创建 W12D6 后续课程：' + path)
}
const terminalLesson = getDailyCourse('W12D6')
if (terminalLesson) assert.equal(terminalLesson.nextLesson, undefined, 'W12D6 是核心课程终点，不得定义 nextLesson。')
const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 13, '后续推进不得撤销 W12D2 的 13/72 冻结基线')
if (inventory.available >= 17) assert.ok(!inventory.missing.includes('W12D6'), 'W12D6 可用后 inventory 不得继续把 W12D6 记为 missing')
else if (inventory.available >= 14) assert.ok(inventory.missing.includes('W12D4'), 'W12D3 后续推进时 inventory 必须继续把 W12D4 记为 missing')
else assert.ok(inventory.missing.includes('W12D3'), 'inventory 必须继续把 W12D3 记为 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected, frozenHashes: Object.keys(frozenHashes).length }, null, 2))
