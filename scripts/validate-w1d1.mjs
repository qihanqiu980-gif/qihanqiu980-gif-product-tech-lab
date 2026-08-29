import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { countSubstantiveContribution } from '../src/course/evidenceQuality.ts'
import { w1d1 } from '../src/course/w1d1.ts'

const content = await readFile(new URL('../src/course/w1d1.ts', import.meta.url), 'utf8')
const page = await readFile(new URL('../src/views/W1D1Page.vue', import.meta.url), 'utf8')
const reference = await readFile(new URL('../src/reference/w1d1-approved.html', import.meta.url), 'utf8')
const referenceEncoded = await readFile(new URL('../src/reference/w1d1-approved.base64.txt', import.meta.url), 'utf8')
const route = await readFile(new URL('../src/views/DailyCourseRouteView.vue', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
const styles = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')
const evidenceQuality = await readFile(new URL('../src/course/evidenceQuality.ts', import.meta.url), 'utf8')

const referenceSha256 = createHash('sha256').update(reference).digest('hex')
const chapterCount = (reference.match(/class="w1-chapter" data-chapter="\d"/g) || []).length
const retellCount = (reference.match(/class="w1-card w1-retell" data-retell="\d"/g) || []).length
const studioGameCount = (reference.match(/data-studio-game=/g) || []).length

const checks = [
  ['W1D1 使用独立课程 ID', content.includes("id: 'W1D1'")],
  ['正式课程数据仍保留 30/45 分钟路径与完整首学估算', content.includes('core: 30') && content.includes('standard: 45') && content.includes('extension: 135') && content.includes('full: 180')],
  ['正式课程数据仍包含至少 12 个完整概念', (content.match(/\n\s+term: '/g) || []).length >= 12],
  ['正式课程数据仍包含完整教师示范、实验、练习和复习节奏', (content.match(/\n\s+title: '第 \d+ 步/g) || []).length >= 8 && (content.match(/cannotProve:/g) || []).length >= 6 && (content.match(/id: 'w1d1-ex\d-/g) || []).length >= 3 && ['D1', 'D3', 'D7', 'D14', 'D30', 'D60'].every((stage) => content.includes(`stage: '${stage}'`))],
  ['批准原型正文哈希与冻结基准一致', referenceSha256 === '6bc6ced62ea095ac51e94fb006f98fbf3e51d30bcda341cb7f9f96f549d5c0bd'],
  ['Base64 运输层可无损还原批准原型', Buffer.from(referenceEncoded.trim(), 'base64').toString('utf8') === reference],
  ['正式页无损解码批准原型，不另写近似 DOM', page.includes("import referenceEncoded from '../reference/w1d1-approved.base64.txt?raw'") && page.includes('new TextDecoder().decode(referenceBytes)') && page.includes(':srcdoc="referenceHtml"')],
  ['正式页使用原型自己的完整工作台外壳', reference.includes('class="w1-global-sidebar"') && reference.includes('class="w1-window"') && reference.includes('class="w1-appbar"') && reference.includes('class="w1-shell"')],
  ['原型左侧全局导航、中央正文和右侧学习路线均保留', reference.includes('class="w1-global-nav"') && reference.includes('class="w1-main"') && reference.includes('class="w1-route" aria-label="课程章节目录"')],
  ['原型背景布局与深海军蓝框架保留', reference.includes('--w1-reference-navy: #062f43') && reference.includes('--w1-reference-navy-deep: #05283a') && reference.includes('Background-only preview: reference-image navy canvas')],
  ['原型标题区、双学习时段和 76 分钟比例区保留', reference.includes('class="w1-hero"') && reference.includes('class="w1-session-strip"') && reference.includes('<strong>76 分钟</strong>')],
  ['原型固定为 7 章正式展示结构', chapterCount === 7 && reference.includes('7 章 · 76 分钟 · 状态分开记录')],
  ['7 次复述与机制练习完整保留', retellCount === 7 && studioGameCount >= 7],
  ['原型的清空并重做逻辑完整保留', reference.includes("button.textContent = '清空并重做'") && reference.includes('function addResetControl')],
  ['学习、练习、复述与实操状态保持分离', ['learn: false', 'practice: false', 'retell: false', 'lab: false'].every((token) => reference.includes(token)) && reference.includes('掌握未判定')],
  ['正式页通过既有证据账本保存原型操作草稿', page.includes('saveDayDraft') && page.includes("const DRAFT_KEY = 'w1d1ReferenceReplica'") && page.includes('saveEvidenceState')],
  ['正式页不会把临时完成直接当作掌握证据', !page.includes('addAttempt') && page.includes("setDayProgressStatus(evidenceLedger.value, w1d1.id, 'completed'" )],
  ['原型全局导航回接正式应用路由', page.includes("const views: ProductView[] = ['today', 'course', 'review', 'progress', 'glossary']") && route.includes("navigate: [view: 'today' | 'course' | 'review' | 'progress' | 'glossary']") && app.includes('@navigate="navigate($event)"')],
  ['正式应用外壳在 W1D1 中不与原型侧栏重复', styles.includes('.app-shell.day-active > .side-rail') && styles.includes('display: none !important;') && styles.includes('.app-shell.day-active > .main-canvas')],
  ['成果门槛计算规则仍保留', evidenceQuality.includes('unchangedLines') && evidenceQuality.includes("/^\\s*#{1,6}\\s+/")],
]

const standardTemplate = w1d1.deliverable.standardTemplate
assert.equal(countSubstantiveContribution(standardTemplate, standardTemplate), 0)
assert.equal(countSubstantiveContribution(`${standardTemplate}\n# ${'甲'.repeat(200)}`, standardTemplate), 0)
assert.equal(countSubstantiveContribution(`${standardTemplate}\n${'丁'.repeat(200)}\n---`, standardTemplate), 0)
assert.equal(countSubstantiveContribution('ABC123', ''), 6)

const failed = checks.filter(([, passed]) => !passed)
checks.forEach(([label, passed]) => console.log(`${passed ? 'PASS' : 'FAIL'}  ${label}`))
if (failed.length) {
  console.error(`W1D1 原型复制校验失败：${failed.length} 项。`)
  process.exit(1)
}
console.log(`W1D1 原型复制校验通过：${checks.length}/${checks.length}。`)
