import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDay01FrameworkPlan } from '../src/course/day01Framework.ts'
import { getDailyCourse } from '../src/course/registry.ts'
import { getDailyCourseRouteState } from '../src/course/dayRouteState.ts'
import { parseHashRoute, routeToHash } from '../src/hashRouter.ts'
import { addAttempt, createEvidenceState, scheduleReviewTasks } from '../src/evidenceStore.ts'

const lesson = getDailyCourse('W1D5')
const plan = getDay01FrameworkPlan('W1D5')
assert.ok(lesson && plan, 'W1D5 必须同时存在完整 DailyCourse 与 Day 01 七章计划')
assert.equal(getDailyCourseRouteState('W1D5').status, 'available', 'W1D5 必须由真实内容与实现门禁计算为 available')
assert.equal(getDailyCourseRouteState('W1D5').access.requiresPriorDayCompletion, false, 'W1D5 不得依赖 W1D4 完成状态')
assert.deepEqual(parseHashRoute('#/lesson/W1D5'), { view: 'day', dayId: 'W1D5' }, 'W1D5 深链必须直接解析为当前工作台日课')
assert.equal(routeToHash({ view: 'day', dayId: 'W1D5' }), '#/lesson/W1D5', 'W1D5 路由序列化必须保持正式深链')
assert.equal(plan.chapters.length, 7, 'W1D5 主目录必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7], 'W1D5 七章编号必须连续')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, 'W1D5 第一时段必须四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, 'W1D5 第二时段必须三章')

const requiredSections = ['scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration', 'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion']
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const section of requiredSections) assert.ok(mappedSections.has(section), `W1D5 七章漏掉语义字段 ${section}`)
const conceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...mappedConceptIds].sort(), [...conceptIds].sort(), 'W1D5 七章必须覆盖全部首次教学概念')
const guidedConceptIds = new Set(lesson.guidedLab.conceptIds)
const independentConceptIds = new Set(lesson.independentLab.conceptIds)
const exerciseConceptIds = new Set(lesson.exercises.flatMap((exercise) => exercise.conceptIds))
const deliverableConceptIds = new Set(lesson.deliverable.conceptIds)
const memoryConceptIds = new Set(lesson.memory.conceptIds)
for (const conceptId of conceptIds) {
  assert.ok(guidedConceptIds.has(conceptId), `首教概念 ${conceptId} 必须进入 Network 引导实验`)
  assert.ok(independentConceptIds.has(conceptId), `首教概念 ${conceptId} 必须进入独立变式`)
  assert.ok(exerciseConceptIds.has(conceptId), `首教概念 ${conceptId} 必须进入针对性练习`)
  assert.ok(deliverableConceptIds.has(conceptId), `首教概念 ${conceptId} 必须进入成果证据`)
  assert.ok(memoryConceptIds.has(conceptId), `首教概念 ${conceptId} 必须进入复述与复习`)
}

const serialized = JSON.stringify({ lesson, plan })
for (const field of ['请求条目', 'Name', 'Request URL', 'Method', 'Status', 'Type', 'Initiator', 'Headers', 'Payload', 'Response', 'Timing', 'Size', '缓存']) {
  assert.ok(serialized.includes(field), `W1D5 缺少 Network 字段首次教学：${field}`)
}
for (const boundary of ['看到', '可以推断', '还不能证明', '下一步']) assert.ok(serialized.includes(boundary), `W1D5 缺少证据记录字段：${boundary}`)
for (const variant of ['正常', '4xx', '5xx', '慢 Timing', 'Size', 'Initiator', '缓存']) assert.ok(serialized.includes(variant), `W1D5 缺少观察器变式：${variant}`)
for (const forbidden of ['SaveReadingProgressHandler', 'WRITE_CONFIRMED', 'PAGE_OUT_OF_RANGE', 'PROGRESS_SAVED', 'checkout/preview', 'PREVIEW_READY']) {
  assert.ok(!serialized.includes(forbidden), `W1D5 不得复制 W1D3/W1D4 案例或答案：${forbidden}`)
}
assert.equal(lesson.deliverable.title, 'Network 观察记录')
assert.match(lesson.guidedLab.safety, /教学模拟/) 
assert.match(lesson.guidedLab.safety, /不发送真实请求/) 

const viewPath = fileURLToPath(new URL('../src/components/W1D5Day01CourseView.vue', import.meta.url))
const viewSource = readFileSync(viewPath, 'utf8')
const template = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) assert.ok(template.includes(shellClass), `W1D5 缺少正式外壳 ${shellClass}`)
assert.match(template, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, 'W1D5 必须保持课程活动态')
assert.doesNotMatch(template, /daily-course-toolbar|duration-switch|返回课程路线/, 'W1D5 不得出现外置返回/时长工具栏')
assert.equal((template.match(/class="w1-route-item"/g) ?? []).length, 2, 'W1D5 桌面两时段与移动目录必须各自渲染七章循环')
assert.ok((template.match(/'is-done': evidence\.frameworkChapters\[chapter\.id\]\.(learn|practicePassed|retellSubmitted)/g) ?? []).length >= 6, 'W1D5 桌面与移动目录必须独立表达三项状态')
assert.match(viewSource, /state\.practicePassed = false; state\.retell = ''; state\.retellSubmitted = false/, '章节重置必须立即撤销练习与复述状态')
assert.match(viewSource, /networkObserver = blankNetworkObserver\(\)[\s\S]*?guidedLab = blankEvidence\(\)\.guidedLab/, '观察器全部清空必须恢复真实初始态')
assert.match(viewSource, /normal:[\s\S]*?client4xx:[\s\S]*?server5xx:[\s\S]*?slow:[\s\S]*?sizeVariation:[\s\S]*?initiatorVariation:[\s\S]*?cacheVariation:/, '观察器覆盖必须包含七类变式')
assert.match(viewSource, /Object\.values\(observerCoverage\.value\)\.every\(Boolean\)/, '七类变式未全部运行时不得保存系统实操证据')
assert.match(viewSource, /class="network-table-scroll" tabindex="0" aria-label="教学模拟 Network 请求表格，可横向浏览"/, 'Network 表格横向滚动容器必须受控且可访问')
assert.match(viewSource, /\.network-table-scroll\s*\{[\s\S]*?overflow-x:auto;[\s\S]*?overflow-y:hidden;/, '只有 Network 表格容器可横向浏览且不得纵向滚动')
const horizontalScrollDeclarations = [...viewSource.matchAll(/overflow-x\s*:\s*auto/g)]
assert.equal(horizontalScrollDeclarations.length, 1, 'W1D5 只允许 Network 表格容器声明横向滚动')
assert.match(viewSource, /\.relationship-map>ol\s*\{[\s\S]*?grid-template-columns:repeat\(4,minmax\(0,1fr\)\);[\s\S]*?overflow:visible;/, '理解图必须通过可换行网格防止横向溢出')
assert.match(viewSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面目录必须 sticky 且无独立滚动')
assert.match(viewSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生内部纵向滚动')
assert.match(viewSource, /syncDeviceMode\(\)\s*\{\s*deviceMode\.value = window\.innerWidth <= 860 \? 'mobile' : 'desktop'/, '860px 及以下必须切换为 Day 01 手机形态')
assert.match(viewSource, /\.day01-course\s*\{[\s\S]*?padding-left:224px;/, '1440/1024px 桌面形态必须保留 224px 左栏')
assert.match(viewSource, /\.w1-shell\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) 244px;/, '桌面形态必须保留 244px 右侧目录')
assert.match(viewSource, /\.day01-course\[data-device="mobile"\] \.w1-window\s*\{[\s\S]*?width:min\(390px,100%\);[\s\S]*?overflow-x:clip;[\s\S]*?overflow-y:visible;/, '860/390/320px 必须使用无内部纵向滚动的 Day 01 手机窗口')
assert.match(viewSource, /closest<HTMLElement>\('\.main-canvas'\)/, '目录定位必须绑定正式 main-canvas')
assert.match(template, /:aria-label="`练习：\$\{exercise\.prompt\}`"[\s\S]*?:aria-label="`\$\{lesson\.deliverable\.title\}草稿`"/, '开放练习与成果必须有可访问名称')
for (const resetHandler of ['resetChapterCheckpoint', 'resetNetworkObserver', 'resetIndependentLab', 'resetExercise', 'resetDeliverable', 'resetMemory']) {
  assert.ok(viewSource.includes(`function ${resetHandler}`), `W1D5 缺少清空重做路径 ${resetHandler}`)
}
assert.match(viewSource, /watch\(\(\) => props\.evidenceState,[\s\S]*?mergeEvidence\(source\)/, '刷新后必须把正式草稿重新合并到 W1D5 状态')

const pagePath = fileURLToPath(new URL('../src/views/W1D5Page.vue', import.meta.url))
const pageSource = readFileSync(pagePath, 'utf8')
assert.match(pageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'W1D5 bridge 必须接回草稿、追加历史和复习排程')
assert.doesNotMatch(pageSource, /localStorage|sessionStorage/, 'W1D5 不得建立平行状态源')
assert.match(pageSource, /addEventListener\('pagehide', flushDraft\)[\s\S]*?onBeforeUnmount\([\s\S]*?flushDraft\(\)/, '刷新或离开 W1D5 时必须同步落盘最后一份防抖草稿')

const baseAttempt = { dayId: 'W1D5', activityId: 'daily-guided-lab', conceptIds: [...conceptIds], kind: 'practical-operation', passed: true, verification: 'system', evidence: '教学模拟 Network 七变式证据' }
let ledger = addAttempt(createEvidenceState(), { ...baseAttempt, id: 'w1d5-guided-1', attemptedAt: '2026-08-21T09:00:00.000Z' })
ledger = addAttempt(ledger, { ...baseAttempt, id: 'w1d5-guided-2', attemptedAt: '2026-08-21T10:00:00.000Z' })
assert.equal(ledger.attempts.length, 2, 'W1D5 历史尝试必须追加而非覆盖')
ledger = scheduleReviewTasks(ledger, { dayId: 'W1D5', conceptIds: [...conceptIds], learnedAt: '2026-08-21T10:00:00.000Z', sourceAttemptId: 'w1d5-guided-2' })
assert.equal(ledger.reviewTasks.length, conceptIds.size * 6, '每个 W1D5 首教概念必须排程六阶段复习')
for (const conceptId of conceptIds) assert.deepEqual(ledger.reviewTasks.filter((task) => task.conceptId === conceptId).map((task) => task.stage), ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'])

console.log(JSON.stringify({ dayId: lesson.id, chapters: plan.chapters.length, concepts: lesson.concepts.length, variants: 7, reviewTasks: ledger.reviewTasks.length }, null, 2))
