import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Script } from 'node:vm'

const rootIndexPath = new URL('../index.html', import.meta.url)
const html = await readFile(rootIndexPath, 'utf8')
const failures = []

const assertAbsent = (pattern, message) => {
  if (pattern.test(html)) failures.push(message)
}

assertAbsent(/<script\b[^>]*\bsrc=/i, '根 index.html 仍引用外部脚本。')
assertAbsent(/<script\b[^>]*\btype=["']module["']/i, '根 index.html 仍依赖模块脚本。')
assertAbsent(/<link\b[^>]*\brel=["']stylesheet["']/i, '根 index.html 仍引用外部样式。')
assertAbsent(/<link\b[^>]*\brel=["']manifest["']/i, '根 index.html 仍引用 Web App Manifest。')
assertAbsent(/url\((['"]?)\.\//i, '内嵌样式仍引用相对资源。')
assertAbsent(/\bimport\.meta\b/i, '内嵌脚本仍包含 import.meta。')
assertAbsent(/\bimport\s*\(/i, '内嵌脚本仍包含动态 import()。')
assertAbsent(/\/Users\/mac\/Documents\/ChatGPT\/编程学习/i, '离线入口仍包含已废弃项目路径。')

const inlineStyles = [...html.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi)]
const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
const fontDataUrls = html.match(/data:font\/woff2;base64,/g) ?? []

if (inlineStyles.length === 0) failures.push('根 index.html 没有内嵌样式。')
if (inlineScripts.length < 2) failures.push('根 index.html 缺少启动保护或课程主脚本。')
if (fontDataUrls.length === 0) failures.push('根 index.html 没有内嵌课程字体。')

for (const [index, match] of inlineScripts.entries()) {
  try {
    new Script(match[1], { filename: `offline-inline-${index + 1}.js` })
  } catch (error) {
    failures.push(`第 ${index + 1} 个内嵌脚本无法作为经典脚本解析：${error.message}`)
  }
}

if (failures.length > 0) {
  console.error(JSON.stringify({ valid: false, failures }, null, 2))
  process.exit(1)
}

const bytes = Buffer.byteLength(html)
const sha256 = createHash('sha256').update(html).digest('hex')
console.log(JSON.stringify({
  valid: true,
  bytes,
  sha256,
  inlineStyles: inlineStyles.length,
  inlineScripts: inlineScripts.length,
  embeddedWoff2Fonts: fontDataUrls.length,
  externalRuntimeAssets: 0,
}, null, 2))
