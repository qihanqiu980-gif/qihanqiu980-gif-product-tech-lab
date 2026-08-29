import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { getDay01FrameworkPlan } from '../src/course/day01Framework.ts'
import { getDailyCourse } from '../src/course/registry.ts'
import { getDailyCourseRouteState } from '../src/course/dayRouteState.ts'
import { validateDailyCourse } from '../src/course/validateDailyCourse.ts'
import { addAttempt, createEvidenceState, scheduleReviewTasks } from '../src/evidenceStore.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const sha = (path) => createHash('sha256').update(readFileSync(fileURLToPath(new URL(path, import.meta.url)))).digest('hex')

const lesson = getDailyCourse('W11D1')
const plan = getDay01FrameworkPlan('W11D1')
assert.ok(lesson && plan, 'W11D1 必须同时存在完整 DailyCourse 与 Day 01 七章框架')
assert.equal(validateDailyCourse(lesson).valid, true, 'W11D1 必须通过完整 DailyCourse 内容合同')
assert.equal(getDailyCourseRouteState('W11D1').status, 'available', 'W11D1 必须由真实内容、实现和 reviewed 共同进入 available')
assert.equal(getDailyCourseRouteState('W11D1').access.requiresPriorDayCompletion, false, 'W11D1 不得依赖前一天或前一阶段完成状态')

assert.equal(plan.chapters.length, 7, 'W11D1 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7], 'W11D1 七章编号必须连续')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须包含前四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须包含后三章')
for (const chapter of plan.chapters) {
  assert.ok(chapter.title.length >= 8 && chapter.lead.length >= 20, `${chapter.id} 缺少独立标题或连续教材导语`)
  assert.ok(chapter.practice.options.length >= 3 && chapter.retellRubric.length >= 3, `${chapter.id} 缺少练习或复述量规`)
}

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), `七章框架漏掉语义字段 ${section}`)
const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖 W11D1 全部首次教学概念')

const serialized = JSON.stringify({ lesson, plan })
for (const phrase of ['AI 功能不是一个 Prompt', '上下文包', '模型生成边界', '知识与动作能力槽位', '业务规则与编排', '输出交付与人工兜底', '运行观察与审计关联', 'AI 系统链路说明']) {
  assert.ok(serialized.includes(phrase), `W11D1 缺少正式系统链主题：${phrase}`)
}
for (const phrase of ['本课只定位', '后续课程', '不调用真实模型', '不能证明', '人工接管']) {
  assert.ok(serialized.includes(phrase), `W11D1 缺少未来主题边界或安全兜底：${phrase}`)
}
for (const forbidden of ['年龄门槛', 'DOM 沙盒', '活动报名', 'NXDOMAIN', '教学寻址台', 'Network 请求条目', '退款已经完成']) {
  assert.ok(!serialized.includes(forbidden), `W11D1 不得复制旧课正文或伪造真实结果：${forbidden}`)
}
for (const futureMechanism of ['Embedding 向量化步骤', '召回排序算法', '工具鉴权实现', '真实工具执行', 'Prompt Injection 攻击实验', '20 条评测样本评分']) {
  assert.ok(!serialized.includes(futureMechanism), `W11D1 不得提前首教后续 Day 机制：${futureMechanism}`)
}

const implementationSource = read('../src/course/implementationRegistry.ts')
assert.match(implementationSource, /dayId:\s*'W11D1'[\s\S]*?W11D1Page\.vue/, 'W11D1 必须使用独立 renderer')
assert.match(implementationSource, /ai-system-chain-observer-day01-v1[\s\S]*?w11d1-evidence-v2/, 'W11D1 必须注册领域实验与 schema v2 证据适配器')

const pageSource = read('../src/views/W11D1Page.vue')
const viewSource = read('../src/components/W11D1Day01CourseView.vue')
const cssSource = read('../src/components/W11D1Day01CourseView.css')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped'))
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'bridge 必须接回草稿、追加式历史与复习排程')
assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'bridge 必须接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, '不得恢复独立落地页工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), `W11D1 缺少正式 Day 01 外壳 ${shellClass}`)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '进入 W11D1 后课程必须保持活动态')
assert.equal((visibleTemplate.match(/class="w1-route-item"/g) ?? []).length, 2, '移动目录与桌面目录必须都由同一七章计划渲染')
assert.match(visibleTemplate, /v-for="session in \[1, 2\]"[\s\S]*?plan\.chapters\.filter\(\(item\) => item\.session === session\)/, '桌面目录必须由同一循环渲染两个时段')
for (const stateKey of ['learn', 'practicePassed', 'retellSubmitted']) {
  assert.equal((visibleTemplate.match(new RegExp(`'is-done': evidence\\.frameworkChapters\\[chapter\\.id\\]\\.${stateKey}`, 'g')) ?? []).length, 2, `桌面与移动目录必须分别表达 ${stateKey}`)
}
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须撤销练习和复述临时完成态')
assert.match(viewSource, /complete[\s\S]*?missing-context[\s\S]*?capability-unavailable[\s\S]*?policy-blocked/, '教学观察器必须覆盖四类系统路径')
assert.match(viewSource, /不调用真实模型、RAG、工具、账号、Token、公司数据或生产系统/, '实验必须明确本地模拟与安全边界')
assert.match(viewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, '当前位置必须绑定正式主滚动面')
assert.match(viewSource, /:aria-label="`学习：\$\{[\s\S]*?:aria-label="`练习：\$\{[\s\S]*?:aria-label="`复述：\$\{/, '目录三类状态必须有可访问名称')
assert.match(cssSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面目录必须 sticky 且无独立纵向滚动')
assert.match(cssSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, '移动目录必须吸附在 54px appbar 下方')
assert.match(cssSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生第二条纵向滚动条')

const attemptBase = { dayId: 'W11D1', activityId: 'daily-guided-lab', conceptIds: [...lessonConceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: 'AI 系统链教学模拟证据' }
let state = addAttempt(createEvidenceState(), { ...attemptBase, id: 'w11d1-guided-1', attemptedAt: '2026-08-22T09:00:00.000Z' })
state = addAttempt(state, { ...attemptBase, id: 'w11d1-guided-2', attemptedAt: '2026-08-22T10:00:00.000Z' })
assert.equal(state.attempts.length, 2, 'W11D1 修订提交必须追加，不能覆盖原始尝试')
state = scheduleReviewTasks(state, { dayId: 'W11D1', conceptIds: [...lessonConceptIds], learnedAt: '2026-08-22T10:00:00.000Z', sourceAttemptId: 'w11d1-guided-2' })
assert.equal(state.reviewTasks.length, lessonConceptIds.size * 6, '每个首次教学概念必须排程六阶段复习')

const frozenHashes = {
  '../src/components/W1D2Day01CourseView.vue': 'ca6b0ae50e9999e2c0dbcd8fb7b5733bec43ff619da87df11ed092bf09c2ec0d',
  '../src/components/W1D3Day01CourseView.vue': '0d307559b12521caca9e9e9721ba0ca05e0a11479d17c925e712e33a8a6b7ad1',
  '../src/components/W1D4Day01CourseView.vue': 'a87d1307c2427ba23c94ec262a1c8edfdcf7af84b78d74cbedb26573321c1c4e',
  '../src/components/W1D5Day01CourseView.vue': 'a3ffa10b51a79741c80ad274fb71ab814d2482cbbc72dedcc35a054df4a20c4c',
  '../src/course/w1d1.ts': '46f0fbd33e2f7bbc0cc942bda641a2033b504141f056ca98d50170606c0374e9',
  '../src/course/w1d2.ts': '98188ab3b051e5a63d45931ec08f82d7c967ab98cbba67e4805776fc9dbfb1ba',
  '../src/course/w1d3.ts': 'dd0664aa1b4288138da9aa537dc6295dd305ddaa68366f96cca215d9fb5b37f5',
  '../src/course/w1d4.ts': 'e824e93a101e8c1855d9dda070d979c3cda9c93b1fb2ac33358c80db37fe092c',
  '../src/course/w1d5.ts': 'ffae548537c7824e405259f591aa3cc86b178ac7cf54dba00a8aea57dd4d2135',
  '../src/views/W1D1Page.vue': 'd32da15360385cc110477660294b467547c346aa3654cf4782ef563079b12296',
  '../src/views/W1D2Page.vue': '588711d612f48242f7dea67d96678060cc0fa30c144e1b8576d2ef9a4ae12a19',
  '../src/views/W1D3Page.vue': '307a328d213131792c72effc0aba0df7223854d41061ab5ecef2b733b51c4e77',
  '../src/views/W1D4Page.vue': '12fe543e867916d69b95e1133f57df27198a51edf52dcbfe1c633a2747c5c093',
  '../src/views/W1D5Page.vue': 'a0cf7a3bcec45f34951cc47526ce158681127f1f350074df525f76e1b3d4141a',
  '../src/reference/w1d1-approved.html': '6bc6ced62ea095ac51e94fb006f98fbf3e51d30bcda341cb7f9f96f549d5c0bd',
}
for (const [path, expected] of Object.entries(frozenHashes)) assert.equal(sha(path), expected, `冻结回归文件漂移：${path}`)
for (const path of ['../src/course/w13d1.ts', '../src/views/W13D1Page.vue', '../src/components/W13D1Day01CourseView.vue', '../src/course/w12d7.ts', '../src/views/W12D7Page.vue', '../src/components/W12D7Day01CourseView.vue']) {
  assert.equal(existsSync(fileURLToPath(new URL(path, import.meta.url))), false, `不得创建 W12D6 后续课程 ${path}`)
}
const terminalLesson = getDailyCourse('W12D6')
if (terminalLesson) assert.equal(terminalLesson.nextLesson, undefined, 'W12D6 是核心课程终点，不得定义 nextLesson。')

console.log(JSON.stringify({ dayId: lesson.id, chapters: plan.chapters.length, concepts: lesson.concepts.length, sections: requiredSections.length, appendOnlyAttempts: state.attempts.length, reviewTasks: state.reviewTasks.length, frozenHashes: Object.keys(frozenHashes).length, root }, null, 2))
