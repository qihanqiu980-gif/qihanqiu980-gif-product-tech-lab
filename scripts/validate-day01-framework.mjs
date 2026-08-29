import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getDay01FrameworkPlan, listDay01FrameworkPlans } from '../src/course/day01Framework.ts'
import { getDailyCourse } from '../src/course/registry.ts'
import { addAttempt, createEvidenceState, scheduleReviewTasks } from '../src/evidenceStore.ts'

const plans = listDay01FrameworkPlans()
assert.deepEqual(plans.map((plan) => plan.dayId), ['W1D2', 'W1D3', 'W1D4', 'W1D5', 'W3D1', 'W3D2', 'W3D3', 'W3D4', 'W3D5', 'W3D6', 'W4D1', 'W8D1', 'W11D1', 'W11D2', 'W11D3', 'W11D4', 'W11D5', 'W11D6', 'W12D1', 'W12D2', 'W12D3', 'W12D4', 'W12D5', 'W12D6'], '只有已逐日重做的 W1D2–W1D5、W3D1–W4D1、W8D1、W11D1–W11D6 与 W12D1–W12D6 可以登记为 Day 01 框架课程')

const plan = getDay01FrameworkPlan('W1D2')
const lesson = getDailyCourse('W1D2')
assert.ok(plan && lesson, 'W1D2 必须同时存在完整课程和七章框架')
assert.equal(plan.chapters.length, 7, 'W1D2 主路线必须恰好七章')
assert.deepEqual(plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7], '七章编号必须连续')
assert.deepEqual([...new Set(plan.chapters.map((chapter) => chapter.session))], [1, 2], '七章必须分属两个学习时段')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 1).length, 4, '第一时段必须包含前四章')
assert.equal(plan.chapters.filter((chapter) => chapter.session === 2).length, 3, '第二时段必须包含后三章')
assert.equal(new Set(plan.chapters.map((chapter) => chapter.id)).size, 7, '七章 ID 不得重复')

for (const chapter of plan.chapters) {
  assert.ok(chapter.title.length >= 8 && chapter.lead.length >= 20, `${chapter.id} 缺少当天专属标题或导语`)
  assert.ok(chapter.practice.prompt.length >= 8, `${chapter.id} 缺少机制练习`)
  assert.ok(chapter.practice.options.length >= 3, `${chapter.id} 练习选项不足`)
  assert.ok(chapter.practice.answerIndex >= 0 && chapter.practice.answerIndex < chapter.practice.options.length, `${chapter.id} 练习答案无效`)
  assert.ok(chapter.practice.explanation.length >= 12, `${chapter.id} 练习必须解释机制`)
  assert.ok(chapter.retellPrompt.length >= 12 && chapter.retellRubric.length >= 3, `${chapter.id} 缺少自主复述与量规`)
}

const requiredSemanticSections = [
  'scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration',
  'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory', 'completion',
]
for (const frameworkPlan of plans) {
  const frameworkLesson = getDailyCourse(frameworkPlan.dayId)
  assert.ok(frameworkLesson, `${frameworkPlan.dayId} 必须同时存在完整课程和七章框架`)
  assert.equal(frameworkPlan.chapters.length, 7, `${frameworkPlan.dayId} 主路线必须恰好七章`)
  assert.deepEqual(frameworkPlan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7], `${frameworkPlan.dayId} 七章编号必须连续`)
  assert.deepEqual([...new Set(frameworkPlan.chapters.map((chapter) => chapter.session))], [1, 2], `${frameworkPlan.dayId} 七章必须分属两个学习时段`)
  assert.equal(frameworkPlan.chapters.filter((chapter) => chapter.session === 1).length, 4, `${frameworkPlan.dayId} 第一时段必须包含前四章`)
  assert.equal(frameworkPlan.chapters.filter((chapter) => chapter.session === 2).length, 3, `${frameworkPlan.dayId} 第二时段必须包含后三章`)
  for (const chapter of frameworkPlan.chapters) {
    assert.ok(chapter.title.length >= 8 && chapter.lead.length >= 20, `${frameworkPlan.dayId} ${chapter.id} 缺少当天专属标题或导语`)
    assert.ok(chapter.practice.prompt.length >= 8 && chapter.practice.options.length >= 3, `${frameworkPlan.dayId} ${chapter.id} 缺少机制练习`)
    assert.ok(chapter.practice.answerIndex >= 0 && chapter.practice.answerIndex < chapter.practice.options.length, `${frameworkPlan.dayId} ${chapter.id} 练习答案无效`)
    assert.ok(chapter.practice.explanation.length >= 12, `${frameworkPlan.dayId} ${chapter.id} 练习必须解释机制`)
    assert.ok(chapter.retellPrompt.length >= 12 && chapter.retellRubric.length >= 3, `${frameworkPlan.dayId} ${chapter.id} 缺少自主复述与量规`)
  }
  const sectionIds = new Set(frameworkPlan.chapters.flatMap((chapter) => chapter.semanticSections))
  for (const sectionId of requiredSemanticSections) {
    assert.ok(sectionIds.has(sectionId), `${frameworkPlan.dayId} 七章框架漏掉语义字段 ${sectionId}`)
  }
  const dayConceptIds = new Set(frameworkLesson.concepts.map((concept) => concept.id))
  const chapterConceptIds = new Set(frameworkPlan.chapters.flatMap((chapter) => chapter.conceptIds))
  assert.deepEqual([...chapterConceptIds].sort(), [...dayConceptIds].sort(), `${frameworkPlan.dayId} 七章必须覆盖全部首次教学概念`)
}
const mappedSections = new Set(plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const sectionId of requiredSemanticSections) {
  assert.ok(mappedSections.has(sectionId), `七章框架漏掉语义字段 ${sectionId}`)
}

const lessonConceptIds = new Set(lesson.concepts.map((concept) => concept.id))
const mappedConceptIds = new Set(plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...mappedConceptIds].sort(), [...lessonConceptIds].sort(), '七章必须覆盖 W1D2 全部首次教学概念')
assert.equal(lesson.contentVersion, 'w1d2-addressing-day01-v2', 'W1D2 内容版本必须标记 Day 01 框架升级')

const forbiddenW1D1Content = ['年龄门槛', 'DOM 沙盒', '活动报名', '优惠券门槛']
const serializedPlan = JSON.stringify(plan)
for (const phrase of forbiddenW1D1Content) {
  assert.ok(!serializedPlan.includes(phrase), `W1D2 不得复制 W1D1 内容：${phrase}`)
}

const implementationPath = fileURLToPath(new URL('../src/course/implementationRegistry.ts', import.meta.url))
const implementationSource = readFileSync(implementationPath, 'utf8')
assert.match(implementationSource, /dayId:\s*'W1D2'[\s\S]*?W1D2Page\.vue/, 'W1D2 必须使用独立七章 renderer')
assert.doesNotMatch(implementationSource, /dayId:\s*'W1D3'[\s\S]*?W1D2Page\.vue/, 'W1D3 不得被本轮 W1D2 renderer 改造影响')

const pagePath = fileURLToPath(new URL('../src/views/W1D2Page.vue', import.meta.url))
const pageSource = readFileSync(pagePath, 'utf8')
const viewPath = fileURLToPath(new URL('../src/components/W1D2Day01CourseView.vue', import.meta.url))
const viewSource = readFileSync(viewPath, 'utf8')
const visibleTemplate = viewSource.slice(viewSource.indexOf('<template>'), viewSource.indexOf('<style scoped>'))

assert.match(pageSource, /@navigate="emit\('navigate', \$event\)"/, 'W1D2 必须通过 bridge 接回正式应用导航')
assert.doesNotMatch(pageSource, /daily-course-toolbar|duration-switch|返回课程路线/, 'W1D2 页面不得恢复独立落地页工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(visibleTemplate.includes(shellClass), `W1D2 缺少 Day 01 正式外壳 ${shellClass}`)
}
assert.match(visibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '进入 W1D2 后“课程”必须是左栏活动栏目')
assert.doesNotMatch(visibleTemplate, /route-column|daily-course-toolbar|duration-switch|返回课程路线/, 'W1D2 可见 DOM 不得残留旧独立落地页拓扑')
assert.equal((visibleTemplate.match(/class="w1-route-item"/g) ?? []).length, 3, '桌面两时段与移动目录必须各自渲染七章按钮')
assert.ok((visibleTemplate.match(/'is-done': evidence\.frameworkChapters\[chapter\.id\]\.(learn|practicePassed|retellSubmitted)/g) ?? []).length >= 9, '桌面和移动目录必须独立表达学习、练习、复述')
assert.match(viewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, '清空重做必须撤销练习和复述的临时完成态')
assert.match(viewSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, '桌面右栏必须随主页面滚动 sticky，不得自带纵向滚动')
assert.match(viewSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, '移动目录必须吸附在 54px appbar 下方')
assert.match(viewSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, '移动目录不得产生第二条纵向滚动条')

const w1d3Plan = getDay01FrameworkPlan('W1D3')
const w1d3Lesson = getDailyCourse('W1D3')
assert.ok(w1d3Plan && w1d3Lesson, 'W1D3 必须同时存在完整课程和七章框架')
assert.equal(w1d3Plan.chapters.length, 7, 'W1D3 主路线必须恰好七章')
assert.deepEqual(w1d3Plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7], 'W1D3 七章编号必须连续')
assert.deepEqual([...new Set(w1d3Plan.chapters.map((chapter) => chapter.session))], [1, 2], 'W1D3 七章必须分属两个学习时段')
assert.equal(w1d3Plan.chapters.filter((chapter) => chapter.session === 1).length, 4, 'W1D3 第一时段必须包含前四章')
assert.equal(w1d3Plan.chapters.filter((chapter) => chapter.session === 2).length, 3, 'W1D3 第二时段必须包含后三章')

for (const chapter of w1d3Plan.chapters) {
  assert.ok(chapter.title.length >= 8 && chapter.lead.length >= 20, `${chapter.id} 缺少 W1D3 专属标题或导语`)
  assert.ok(chapter.practice.prompt.length >= 8 && chapter.practice.options.length >= 3, `${chapter.id} 缺少 W1D3 机制练习`)
  assert.ok(chapter.practice.answerIndex >= 0 && chapter.practice.answerIndex < chapter.practice.options.length, `${chapter.id} W1D3 练习答案无效`)
  assert.ok(chapter.practice.explanation.length >= 12, `${chapter.id} W1D3 练习必须解释机制`)
  assert.ok(chapter.retellPrompt.length >= 12 && chapter.retellRubric.length >= 3, `${chapter.id} 缺少 W1D3 自主复述与量规`)
}

const w1d3MappedSections = new Set(w1d3Plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const sectionId of requiredSemanticSections) {
  assert.ok(w1d3MappedSections.has(sectionId), `W1D3 七章框架漏掉语义字段 ${sectionId}`)
}
const w1d3LessonConceptIds = new Set(w1d3Lesson.concepts.map((concept) => concept.id))
const w1d3MappedConceptIds = new Set(w1d3Plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...w1d3MappedConceptIds].sort(), [...w1d3LessonConceptIds].sort(), '七章必须覆盖 W1D3 全部首次教学概念')
assert.equal(w1d3Lesson.contentVersion, 'w1d3-http-day01-v2', 'W1D3 内容版本必须标记 Day 01 框架升级')

const w1d3SerializedPlan = JSON.stringify(w1d3Plan)
for (const phrase of ['年龄门槛', 'DOM 沙盒', '活动报名', 'NXDOMAIN', '教学寻址台']) {
  assert.ok(!w1d3SerializedPlan.includes(phrase), `W1D3 不得复制 W1D1/W1D2 内容：${phrase}`)
}
for (const phrase of ['Request', 'Response', 'Method', 'Header', 'Payload', 'Status', 'Timing']) {
  assert.ok(w1d3SerializedPlan.includes(phrase), `W1D3 七章必须教授自己的 HTTP 内容：${phrase}`)
}

assert.match(implementationSource, /dayId:\s*'W1D3'[\s\S]*?W1D3Page\.vue/, 'W1D3 必须使用独立七章 renderer')
const w1d3PagePath = fileURLToPath(new URL('../src/views/W1D3Page.vue', import.meta.url))
const w1d3PageSource = readFileSync(w1d3PagePath, 'utf8')
const w1d3ViewPath = fileURLToPath(new URL('../src/components/W1D3Day01CourseView.vue', import.meta.url))
const w1d3ViewSource = readFileSync(w1d3ViewPath, 'utf8')
const w1d3VisibleTemplate = w1d3ViewSource.slice(w1d3ViewSource.indexOf('<template>'), w1d3ViewSource.indexOf('<style scoped>'))

assert.match(w1d3PageSource, /@navigate="emit\('navigate', \$event\)"/, 'W1D3 必须通过 bridge 接回正式应用导航')
assert.doesNotMatch(w1d3PageSource, /daily-course-toolbar|duration-switch|返回课程路线/, 'W1D3 页面不得恢复独立落地页工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(w1d3VisibleTemplate.includes(shellClass), `W1D3 缺少 Day 01 正式外壳 ${shellClass}`)
}
assert.match(w1d3VisibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '进入 W1D3 后“课程”必须是左栏活动栏目')
assert.doesNotMatch(w1d3VisibleTemplate, /route-column|daily-course-toolbar|duration-switch|返回课程路线/, 'W1D3 可见 DOM 不得残留旧独立落地页拓扑')
assert.equal((w1d3VisibleTemplate.match(/class="w1-route-item"/g) ?? []).length, 3, 'W1D3 桌面两时段与移动目录必须各自渲染七章按钮')
assert.ok((w1d3VisibleTemplate.match(/'is-done': evidence\.frameworkChapters\[chapter\.id\]\.(learn|practicePassed|retellSubmitted)/g) ?? []).length >= 9, 'W1D3 桌面和移动目录必须独立表达学习、练习、复述')
assert.match(w1d3ViewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, 'W1D3 清空重做必须撤销练习和复述的临时完成态')
assert.match(w1d3ViewSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, 'W1D3 桌面右栏必须随主页面滚动 sticky')
assert.match(w1d3ViewSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, 'W1D3 移动目录必须吸附在 54px appbar 下方')
assert.match(w1d3ViewSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, 'W1D3 移动目录不得产生第二条纵向滚动条')
assert.match(w1d3ViewSource, /教学模拟 · 不发送真实请求或账号数据/, 'W1D3 HTTP 台必须明确标记教学模拟')

const w1d4Plan = getDay01FrameworkPlan('W1D4')
const w1d4Lesson = getDailyCourse('W1D4')
assert.ok(w1d4Plan && w1d4Lesson, 'W1D4 必须同时存在完整课程和七章框架')
assert.equal(w1d4Plan.chapters.length, 7, 'W1D4 主路线必须恰好七章')
assert.deepEqual(w1d4Plan.chapters.map((chapter) => chapter.number), [1, 2, 3, 4, 5, 6, 7], 'W1D4 七章编号必须连续')
assert.deepEqual([...new Set(w1d4Plan.chapters.map((chapter) => chapter.session))], [1, 2], 'W1D4 七章必须分属两个学习时段')
assert.equal(w1d4Plan.chapters.filter((chapter) => chapter.session === 1).length, 4, 'W1D4 第一时段必须包含前四章')
assert.equal(w1d4Plan.chapters.filter((chapter) => chapter.session === 2).length, 3, 'W1D4 第二时段必须包含后三章')

for (const chapter of w1d4Plan.chapters) {
  assert.ok(chapter.title.length >= 8 && chapter.lead.length >= 20, `${chapter.id} 缺少 W1D4 专属标题或导语`)
  assert.ok(chapter.practice.prompt.length >= 8 && chapter.practice.options.length >= 3, `${chapter.id} 缺少 W1D4 机制练习`)
  assert.ok(chapter.practice.answerIndex >= 0 && chapter.practice.answerIndex < chapter.practice.options.length, `${chapter.id} W1D4 练习答案无效`)
  assert.ok(chapter.practice.explanation.length >= 12, `${chapter.id} W1D4 练习必须解释机制`)
  assert.ok(chapter.retellPrompt.length >= 12 && chapter.retellRubric.length >= 3, `${chapter.id} 缺少 W1D4 自主复述与量规`)
}

const w1d4MappedSections = new Set(w1d4Plan.chapters.flatMap((chapter) => chapter.semanticSections))
for (const sectionId of requiredSemanticSections) {
  assert.ok(w1d4MappedSections.has(sectionId), `W1D4 七章框架漏掉语义字段 ${sectionId}`)
}
const w1d4LessonConceptIds = new Set(w1d4Lesson.concepts.map((concept) => concept.id))
const w1d4MappedConceptIds = new Set(w1d4Plan.chapters.flatMap((chapter) => chapter.conceptIds))
assert.deepEqual([...w1d4MappedConceptIds].sort(), [...w1d4LessonConceptIds].sort(), '七章必须覆盖 W1D4 全部首次教学概念')
assert.equal(w1d4Lesson.contentVersion, 'w1d4-api-backend-db-day01-v1', 'W1D4 内容版本必须标记 Day 01 框架升级')
assert.equal(w1d4Lesson.deliverable.title, '请求处理链路说明', 'W1D4 今日成果必须是请求处理链路说明')

const w1d4Serialized = JSON.stringify({ plan: w1d4Plan, lesson: w1d4Lesson })
for (const phrase of ['API 入口', '后端业务服务', '业务规则', '数据库读写', '持久化边界', 'Response', '教学模拟']) {
  assert.ok(w1d4Serialized.includes(phrase), `W1D4 必须教授自己的请求处理链内容：${phrase}`)
}
for (const phrase of ['年龄门槛', 'DOM 沙盒', '活动报名', 'NXDOMAIN', '教学寻址台', 'checkout/preview', 'PREVIEW_READY']) {
  assert.ok(!w1d4Serialized.includes(phrase), `W1D4 不得复制 W1D1–W1D3 内容：${phrase}`)
}
for (const futureTopic of ['真实 Network 面板', '鉴权实现', '并发控制', '幂等策略', '复杂 SQL']) {
  assert.ok(!w1d4Serialized.includes(futureTopic), `W1D4 不得提前教授：${futureTopic}`)
}

assert.match(implementationSource, /dayId:\s*'W1D4'[\s\S]*?W1D4Page\.vue/, 'W1D4 必须使用独立七章 renderer')
const w1d4PagePath = fileURLToPath(new URL('../src/views/W1D4Page.vue', import.meta.url))
const w1d4PageSource = readFileSync(w1d4PagePath, 'utf8')
const w1d4ViewPath = fileURLToPath(new URL('../src/components/W1D4Day01CourseView.vue', import.meta.url))
const w1d4ViewSource = readFileSync(w1d4ViewPath, 'utf8')
const routeCatalogPath = fileURLToPath(new URL('../src/data.ts', import.meta.url))
const routeCatalogSource = readFileSync(routeCatalogPath, 'utf8')
const w1d4VisibleTemplate = w1d4ViewSource.slice(w1d4ViewSource.indexOf('<template>'), w1d4ViewSource.indexOf('<style scoped>'))

assert.match(w1d4PageSource, /@navigate="emit\('navigate', \$event\)"/, 'W1D4 必须通过 bridge 接回正式应用导航')
assert.match(w1d4PageSource, /saveDayDraft[\s\S]*?addAttempt[\s\S]*?scheduleReviewTasks/, 'W1D4 bridge 必须接回草稿、追加历史与复习排程')
assert.doesNotMatch(w1d4PageSource, /daily-course-toolbar|duration-switch|返回课程路线/, 'W1D4 页面不得恢复独立落地页工具栏')
for (const shellClass of ['w1-global-sidebar', 'w1-window', 'w1-shell', 'w1-main', 'w1-route', 'w1-mobile-route']) {
  assert.ok(w1d4VisibleTemplate.includes(shellClass), `W1D4 缺少 Day 01 正式外壳 ${shellClass}`)
}
assert.match(w1d4VisibleTemplate, /class="is-current" aria-current="page"[\s\S]*?<span>课程<\/span>/, '进入 W1D4 后“课程”必须是左栏活动栏目')
assert.doesNotMatch(w1d4VisibleTemplate, /route-column|daily-course-toolbar|duration-switch|返回课程路线/, 'W1D4 可见 DOM 不得残留旧独立落地页拓扑')
assert.equal((w1d4VisibleTemplate.match(/class="w1-route-item"/g) ?? []).length, 3, 'W1D4 桌面两时段与移动目录必须各自渲染七章按钮')
assert.ok((w1d4VisibleTemplate.match(/'is-done': evidence\.frameworkChapters\[chapter\.id\]\.(learn|practicePassed|retellSubmitted)/g) ?? []).length >= 9, 'W1D4 桌面和移动目录必须独立表达学习、练习、复述')
assert.match(w1d4ViewSource, /state\.practicePassed = false[\s\S]*?state\.retellSubmitted = false/, 'W1D4 清空重做必须撤销练习和复述的临时完成态')
assert.match(w1d4ViewSource, /教学模拟 · 不发送真实请求，不连接真实服务器或数据库/, 'W1D4 实验必须明确教学模拟与资源边界')
assert.match(w1d4ViewSource, /HTTP Request · 教学模拟[\s\S]*?数据库运行前 · 教学模拟[\s\S]*?Response · 教学模拟/, 'W1D4 请求、数据库记录和 Response 必须逐项标记教学模拟')
assert.match(w1d4ViewSource, /WRITE_CONFIRMED[\s\S]*?PAGE_OUT_OF_RANGE[\s\S]*?WRITE_FAILED[\s\S]*?Object\.values\(processingCoverage\.value\)\.every\(Boolean\)/, 'W1D4 引导实验必须覆盖合法写入、规则拒绝和数据库写入失败后才能保存')
assert.match(w1d4ViewSource, /addEventListener\('scroll', onScrollOwnerScroll[\s\S]*?syncActiveChapterFromScroll/, 'W1D4 当前位置必须持续绑定正式主滚动面')
assert.match(w1d4VisibleTemplate, /:aria-label="`练习：\$\{exercise\.prompt\}`"[\s\S]*?:aria-label="`\$\{lesson\.deliverable\.title\}草稿`"/, 'W1D4 开放练习与成果草稿必须有稳定可访问名称')
assert.match(routeCatalogSource, /\['理解', 'API、后端与数据库',[\s\S]*?'请求处理链路说明'\]/, 'W1D4 课程路线入口必须使用正式 Day 04 标题、链路与成果')
assert.match(w1d4ViewSource, /\.w1-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:16px;[\s\S]*?overflow:visible;/, 'W1D4 桌面右栏必须随主页面滚动 sticky')
assert.match(w1d4ViewSource, /\.day01-course\[data-device="mobile"\] \.w1-mobile-route\s*\{[\s\S]*?position:sticky;[\s\S]*?top:54px;/, 'W1D4 移动目录必须吸附在 54px appbar 下方')
assert.match(w1d4ViewSource, /\.w1-mobile-route \.w1-route-list\s*\{[\s\S]*?max-height:none;[\s\S]*?overflow:visible;/, 'W1D4 移动目录不得产生第二条纵向滚动条')

const w1d4AttemptBase = {
  dayId: 'W1D4', activityId: 'daily-guided-lab', conceptIds: [...w1d4LessonConceptIds], kind: 'practical-operation',
  passed: true, verification: 'system', evidence: '教学模拟请求处理链实操证据',
}
let w1d4EvidenceState = addAttempt(createEvidenceState(), { ...w1d4AttemptBase, id: 'w1d4-guided-1', attemptedAt: '2026-08-21T09:00:00.000Z' })
w1d4EvidenceState = addAttempt(w1d4EvidenceState, { ...w1d4AttemptBase, id: 'w1d4-guided-2', attemptedAt: '2026-08-21T10:00:00.000Z' })
assert.equal(w1d4EvidenceState.attempts.length, 2, 'W1D4 修订提交必须追加，不能覆盖原始尝试')
w1d4EvidenceState = scheduleReviewTasks(w1d4EvidenceState, {
  dayId: 'W1D4', conceptIds: [...w1d4LessonConceptIds], learnedAt: '2026-08-21T10:00:00.000Z', sourceAttemptId: 'w1d4-guided-2',
})
assert.equal(w1d4EvidenceState.reviewTasks.length, w1d4LessonConceptIds.size * 6, 'W1D4 每个首次教学概念必须排程六个复习阶段')
for (const conceptId of w1d4LessonConceptIds) {
  assert.deepEqual(
    w1d4EvidenceState.reviewTasks.filter((task) => task.conceptId === conceptId).map((task) => task.stage),
    ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'],
    `${conceptId} 缺少 D1/D3/D7/D14/D30/D60 复习排程`,
  )
}

console.log(JSON.stringify({ dayIds: plans.map((item) => item.dayId), chaptersPerDay: 7, sessionsPerDay: 2, mappedSemanticSections: requiredSemanticSections.length }, null, 2))
