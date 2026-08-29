import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { weekGuides } from '../src/weekGuides.ts'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const rootIndexPath = resolve(projectRoot, 'index.html')
const distIndexPath = resolve(projectRoot, 'dist/index.html')
const appSourcePath = resolve(projectRoot, 'src/App.vue')

const readText = (path) => readFile(path, 'utf8')
const digest = (buffer) => createHash('sha256').update(buffer).digest('hex')

function metaContent(html, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`<meta\\s+name=["']${escapedName}["']\\s+content=["']([^"']+)["']\\s*/?>`, 'i'))
  assert.ok(match, `${name} meta 不存在`)
  return match[1]
}

function assetScriptPath(html) {
  const match = html.match(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/i)
  assert.ok(match, 'dist/index.html 没有生产脚本引用')
  return resolve(projectRoot, 'dist', match[1].replace(/^\.\//, ''))
}

function resolvedDownloadPath(indexPath, labBase, labPath) {
  const indexUrl = new URL(`file://${indexPath}`)
  const baseUrl = new URL(labBase, indexUrl)
  const relativeArchive = labPath.replace(/^labs\//, '')
  return fileURLToPath(new URL(relativeArchive, baseUrl))
}

const expectedWeeks = Array.from({ length: 10 }, (_, index) => index + 3)
const actualWeeks = Object.keys(weekGuides).map(Number).sort((a, b) => a - b)
assert.deepEqual(actualWeeks, expectedWeeks, '实验资料必须恰好覆盖 W3–W12')

const [rootIndex, distIndex, appSource] = await Promise.all([
  readText(rootIndexPath),
  readText(distIndexPath),
  readText(appSourcePath),
])

const rootLabBase = metaContent(rootIndex, 'course-lab-base')
const distLabBase = metaContent(distIndex, 'course-lab-base')
assert.equal(rootLabBase, './dist/labs/', '根单文件必须把实验下载指向 ./dist/labs/')
assert.equal(distLabBase, './labs/', 'dist 入口必须把实验下载指向 ./labs/')
assert.match(appSource, /:href="labPackUrl"\s+download/, '课程页实验链接必须绑定 labPackUrl 并声明 download')
assert.match(appSource, /activeGuide\.value\.labPack\.path\.replace\(\/\^labs\\\//, '课程页必须去掉权威路径的 labs/ 前缀后再结合 meta 基址')

const distScript = await readText(assetScriptPath(distIndex))
const seenPaths = new Set()
const targets = []

for (const week of expectedWeeks) {
  const guide = weekGuides[week]
  assert.ok(guide, `缺少 W${week} 实验指南`)
  const labPath = guide.labPack.path
  assert.match(labPath, new RegExp(`^labs/W${week}-[^/]+\\.zip$`), `W${week} 实验包路径与周编号不一致`)
  assert.equal(seenPaths.has(labPath), false, `实验包路径重复：${labPath}`)
  seenPaths.add(labPath)

  const archiveName = basename(labPath)
  const publicPath = resolve(projectRoot, 'public/labs', archiveName)
  const distPath = resolve(projectRoot, 'dist/labs', archiveName)
  const [publicBuffer, distBuffer, publicStat, distStat] = await Promise.all([
    readFile(publicPath),
    readFile(distPath),
    stat(publicPath),
    stat(distPath),
  ])

  assert.ok(publicStat.size > 0, `${archiveName} 是空文件`)
  assert.equal(distStat.size, publicStat.size, `${archiveName} 在 public 与 dist 的大小不一致`)
  assert.equal(digest(distBuffer), digest(publicBuffer), `${archiveName} 在 public 与 dist 的内容不一致`)
  assert.ok(rootIndex.includes(labPath), `根单文件脚本未包含 ${labPath}`)
  assert.ok(distScript.includes(labPath), `dist 生产脚本未包含 ${labPath}`)
  assert.equal(resolvedDownloadPath(rootIndexPath, rootLabBase, labPath), distPath, `根单文件下载目标错误：${archiveName}`)
  assert.equal(resolvedDownloadPath(distIndexPath, distLabBase, labPath), distPath, `dist 入口下载目标错误：${archiveName}`)

  targets.push({ week, archive: archiveName, bytes: publicStat.size })
}

console.log(JSON.stringify({
  valid: true,
  weeks: expectedWeeks.length,
  rootLabBase,
  distLabBase,
  publicDistArchivesMatched: targets.length,
  targets,
}, null, 2))
