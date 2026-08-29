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

const lesson = getDailyCourse('W11D4')
const plan = getDay01FrameworkPlan('W11D4')
const implementation = getDayImplementation('W11D4')
assert.ok(lesson && plan && implementation, 'W11D4 必须同时存在完整课程、七章计划与真实实现')
assert.equal(validateDailyCourse(lesson).valid, true, 'W11D4 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W11D4').status, 'available', 'W11D4 只能在内容、实现、门禁与 reviewed 共同满足后开放')
assert.equal(getDailyCourseRouteState('W11D4').access.requiresPriorDayCompletion, false, 'W11D4 不得依赖 W11D3 完成、复习或掌握状态')
assert.equal(implementation.reviewed, true, 'W11D4 通过审阅与专项门禁后才可标为 reviewed')
assert.equal(implementation.renderer.key, 'day01-framework-w11d4')
assert.equal(implementation.experimentAdapter.key, 'failure-classification-gate-observer-day01-v1')
assert.equal(implementation.evidenceAdapter.key, 'w11d4-evidence-v2')

assert.equal(lesson.title, '幻觉从哪里产生', 'W11D4 正式主题必须是幻觉从哪里产生')
assert.equal(lesson.deliverable.title, '失败分类表', 'W11D4 正式成果必须是失败分类表')
assert.equal(lesson.nextLesson?.id, 'W11D5', '下一课只能说明 W11D5，不得创建或替代其内容')
assert.equal(plan.chapters.length, 7, 'W11D4 主目录必须恰好七章')
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
assert.equal(lessonConceptIds.size, 8, 'W11D4 必须有八个独立首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of [
  '评测输出事实', '知识缺失', '召回缺口', '资料冲突', '生成过度推断', '工具链失败', '表达过度确定', '失败分类表',
  'knowledge_gap', 'retrieval_gap', 'source_conflict', 'generation_overreach', 'tool_chain', 'expression_overcertainty',
  'source_exists=false', 'context_missing=true', 'TOOL_TIMEOUT_UNKNOWN', 'first_failed_stage', 'product_action', 'evidence_limit',
  '教学模拟', '不能证明',
]) assert.ok(serialized.includes(phrase), 'W11D4 缺少正式失败分类主题或实验边界：' + phrase)
for (const forbidden of ['成本架构', '延迟架构', 'Prompt injection 架构', '综合评测报告', '真实模型运行结果', '生产根因已证明']) {
  assert.ok(!serialized.includes(forbidden), 'W11D4 不得提前教授 W11D5+ 或越界声明：' + forbidden)
}

assert.equal(lesson.learningPaths['30'].guidedStepIndices.length, 6, '30 分钟路径不得删除六条失败分类路径')
assert.equal(lesson.learningPaths['45'].guidedStepIndices.length, 6, '45 分钟路径必须覆盖六条失败分类路径')
assert.equal(lesson.exercises.length, 4, 'W11D4 必须有四道针对性练习')
assert.deepEqual(lesson.memory.reviewStages.map((item) => item.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])

const pageSource = read('../src/views/W11D4Page.vue')
const viewSource = read('../src/components/W11D4Day01CourseView.vue')
const shellCssSource = read('../src/components/W11D1Day01CourseView.css')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '页面不得恢复外置工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), 'W11D4 缺少正式 Day 01 外壳 ' + shellClass)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '课程必须保持左栏活动态')
assert.equal((visibleTemplate.match(/class="w1-route-item"/g) ?? []).length, 2, '移动目录与桌面目录必须由同一七章计划渲染')
for (const stateKey of ['learn', 'practicePassed', 'retellSubmitted']) {
  assert.equal((visibleTemplate.match(new RegExp("'is-done': evidence\\.frameworkChapters\\[chapter\\.id\\]\\." + stateKey, 'g')) ?? []).length, 2, '桌面与移动目录必须分别表达 ' + stateKey)
}
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须立即撤销练习与复述状态')
assert.match(viewSource, /knowledge-gap[\s\S]*?retrieval-gap[\s\S]*?source-conflict[\s\S]*?generation-overreach[\s\S]*?tool-chain[\s\S]*?expression-overcertainty/, '失败分类观察器必须覆盖六种专属路径')
assert.match(viewSource, /不调用真实模型、工具、账号、Token、公司数据或生产系统/, '实验必须明确本地教学模拟资源边界')
assert.match(viewSource, /lines\.length !== 6[\s\S]*?failure_category[\s\S]*?toolRows < 1[\s\S]*?retrievalRows < 1/, '成果必须机械校验 6 行、六类配额、工具证据和召回证据')
assert.match(viewSource, /deliverableGate\.value\.valid[\s\S]*?saveAttempt\('deliverable'\)/, '成果只有通过失败分类表门禁才可追加保存')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.match(shellCssSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面目录必须 sticky 且无内部纵向滚动')
assert.match(shellCssSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, '移动目录必须吸附在 appbar 下方')
assert.match(shellCssSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生第二条纵向滚动条')

const attemptBase = { dayId: 'W11D4', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '失败分类六路径教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w11d4-guided-1', attemptedAt: '2026-08-22T14:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w11d4-guided-2', attemptedAt: '2026-08-22T15:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W11D4 修订提交必须追加，不能覆盖历史尝试')
state = scheduleReviewTasks(state, { dayId: 'W11D4', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-22T15:00:00.000Z', sourceAttemptId: 'w11d4-guided-2' })
assert.equal(state.reviewTasks.length, 48, '八个首次教学概念必须各排程六阶段复习')
for (const conceptId of lessonConceptIds) {
  assert.deepEqual(state.reviewTasks.filter((task) => task.conceptId === conceptId).map((task) => task.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])
}

const frozenHashes = {
  '../src/reference/w1d1-approved.html': '6bc6ced62ea095ac51e94fb006f98fbf3e51d30bcda341cb7f9f96f549d5c0bd',
  '../src/reference/w1d1-approved.base64.txt': '083ec0be3a5e5ed83476d80bccba9d5788cca1b73e6b966468a5f73f3a248a7f',
  '../src/course/w1d1.ts': '46f0fbd33e2f7bbc0cc942bda641a2033b504141f056ca98d50170606c0374e9',
  '../src/views/W1D1Page.vue': 'd32da15360385cc110477660294b467547c346aa3654cf4782ef563079b12296',
  '../src/course/w1d2.ts': '98188ab3b051e5a63d45931ec08f82d7c967ab98cbba67e4805776fc9dbfb1ba',
  '../src/views/W1D2Page.vue': '588711d612f48242f7dea67d96678060cc0fa30c144e1b8576d2ef9a4ae12a19',
  '../src/components/W1D2Day01CourseView.vue': 'ca6b0ae50e9999e2c0dbcd8fb7b5733bec43ff619da87df11ed092bf09c2ec0d',
  '../src/course/w1d3.ts': 'dd0664aa1b4288138da9aa537dc6295dd305ddaa68366f96cca215d9fb5b37f5',
  '../src/views/W1D3Page.vue': '307a328d213131792c72effc0aba0df7223854d41061ab5ecef2b733b51c4e77',
  '../src/components/W1D3Day01CourseView.vue': '0d307559b12521caca9e9e9721ba0ca05e0a11479d17c925e712e33a8a6b7ad1',
  '../src/course/w1d4.ts': 'e824e93a101e8c1855d9dda070d979c3cda9c93b1fb2ac33358c80db37fe092c',
  '../src/views/W1D4Page.vue': '12fe543e867916d69b95e1133f57df27198a51edf52dcbfe1c633a2747c5c093',
  '../src/components/W1D4Day01CourseView.vue': 'a87d1307c2427ba23c94ec262a1c8edfdcf7af84b78d74cbedb26573321c1c4e',
  '../src/course/w1d5.ts': 'ffae548537c7824e405259f591aa3cc86b178ac7cf54dba00a8aea57dd4d2135',
  '../src/views/W1D5Page.vue': 'a0cf7a3bcec45f34951cc47526ce158681127f1f350074df525f76e1b3d4141a',
  '../src/components/W1D5Day01CourseView.vue': 'a3ffa10b51a79741c80ad274fb71ab814d2482cbbc72dedcc35a054df4a20c4c',
  '../src/course/w11d1.ts': 'ebfd4c6b4fff5ed6924ef69e401bc5c551370b99a3c317f778d0c6ed58bd06ec',
  '../src/views/W11D1Page.vue': '0d29b9cc3a82a7d8a89fe902662b06af61da689d6459ba904435fe81f037e7d6',
  '../src/components/W11D1Day01CourseView.vue': '28e0e6ea6a1e83260b8115debca2c1fe253baea40ee148bb971fdec5bf3cbcdc',
  '../src/components/W11D1Day01CourseView.css': '2d5309d87faeb1b350bef36b23075d419a506ea52e0efd08176ac94518325d38',
  '../src/course/w11d2.ts': '3bd6d3a11dedc3eb249b568af965c194583bd223691065a7ad27431e9523edc2',
  '../src/views/W11D2Page.vue': '75b4661647a8e64704f1ac01480cb0a292f7a1753a61e007a465184d3bf86444',
  '../src/components/W11D2Day01CourseView.vue': '6b4410ea9719daa2ad28390b1f6d8d699f025f567cffce3b4edbe8952da86922',
  '../src/course/w11d3.ts': '6ad61f29af89b1f1d01d6a7587a1001fe41ebebfb2abdf8c094cad6ea7bada22',
  '../src/views/W11D3Page.vue': '26a2677d5b358a1fc636b2b88c3bce1f9c663306282d9ab2b3c90f5ea7623c06',
  '../src/components/W11D3Day01CourseView.vue': 'e3fe79a8f807ae92b6d54f2bdc398484996b370fa28f2be82db869cddbf917b7',
}
for (const [path, expected] of Object.entries(frozenHashes)) assert.equal(sha(path), expected, '冻结回归文件漂移：' + path)

for (const path of ['../src/course/w13d1.ts', '../src/views/W13D1Page.vue', '../src/components/W13D1Day01CourseView.vue', '../src/course/w12d7.ts', '../src/views/W12D7Page.vue', '../src/components/W12D7Day01CourseView.vue']) {
  assert.equal(existsSync(resolve(path)), false, '不得创建 W12D6 后续课程：' + path)
}
const terminalLesson = getDailyCourse('W12D6')
if (terminalLesson) assert.equal(terminalLesson.nextLesson, undefined, 'W12D6 是核心课程终点，不得定义 nextLesson。')
const inventory = getDailyCourseInventory()
assert.ok(inventory.available >= 9, '后续推进不得撤销 W11D4 的 9/72 冻结基线')
if (inventory.available >= 17) assert.ok(!inventory.missing.includes('W12D6'), 'W12D6 可用后 inventory 不得继续把 W12D6 记为 missing')
else if (inventory.available >= 14) assert.ok(inventory.missing.includes('W12D4'), 'W12D3 后续推进时 inventory 必须继续把 W12D4 记为 missing')
else if (inventory.available >= 13) assert.ok(inventory.missing.includes('W12D3'), 'W12D2 后续推进前 inventory 必须继续把 W12D3 记为 missing')
else if (inventory.available >= 12) assert.ok(inventory.missing.includes('W12D2'), 'W12D1 后续推进前 inventory 必须继续把 W12D2 记为 missing')
else assert.ok(inventory.missing.includes('W12D1'), 'inventory 必须继续把 W12D1 记为 missing')

console.log(JSON.stringify({ dayId: lesson.id, title: lesson.title, chapters: plan.chapters.length, concepts: lessonConceptIds.size, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, inventory: inventory.available + '/' + inventory.expected, frozenHashes: Object.keys(frozenHashes).length }, null, 2))
