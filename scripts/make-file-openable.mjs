import { readFile, unlink, writeFile } from 'node:fs/promises'
import { Script } from 'node:vm'

const sourceOutputPath = new URL('../dist/course-source.html', import.meta.url)
const distOutputPath = new URL('../dist/index.html', import.meta.url)
const rootOutputPath = new URL('../index.html', import.meta.url)
const original = await readFile(sourceOutputPath, 'utf8')
const patched = original
  .replace('<script type="module" crossorigin ', '<script defer ')
  .replace('<link rel="stylesheet" crossorigin ', '<link rel="stylesheet" ')

if (patched === original) {
  throw new Error('未找到需要转换的生产资源标签，请检查 Vite 输出格式。')
}

const scriptMatch = patched.match(/<script defer src="([^\"]+)"><\/script>/)
const styleMatch = patched.match(/<link rel="stylesheet" href="([^\"]+)">/)

if (!scriptMatch || !styleMatch) {
  throw new Error('未找到课程的脚本或样式资源，无法生成可双击入口。')
}

const styleOutputPath = new URL(styleMatch[1], sourceOutputPath)
const [scriptSource, styleSource] = await Promise.all([
  readFile(new URL(scriptMatch[1], sourceOutputPath), 'utf8'),
  readFile(styleOutputPath, 'utf8'),
])

const assetMimeTypes = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

const inlineCssAssets = async (css) => {
  const relativeAssetPattern = /url\((['"]?)(\.\/[^)'"\s]+)\1\)/g
  const references = [...css.matchAll(relativeAssetPattern)]
  const replacements = new Map()

  await Promise.all(references.map(async ([fullMatch, , relativePath]) => {
    if (replacements.has(fullMatch)) return
    const extensionMatch = relativePath.match(/(\.[a-z0-9]+)(?:[?#].*)?$/i)
    const mimeType = extensionMatch ? assetMimeTypes[extensionMatch[1].toLowerCase()] : undefined
    if (!mimeType) {
      throw new Error(`离线样式引用了无法识别的资源类型：${relativePath}`)
    }
    const asset = await readFile(new URL(relativePath, styleOutputPath))
    replacements.set(fullMatch, `url(data:${mimeType};base64,${asset.toString('base64')})`)
  }))

  let inlined = css
  for (const [source, replacement] of replacements) {
    inlined = inlined.replaceAll(source, replacement)
  }
  return inlined
}

const safeInlineScript = scriptSource
  .replaceAll('import.meta.url', 'document.baseURI')
  .replaceAll('</script', '<\\/script')
const safeInlineStyle = (await inlineCssAssets(styleSource))
  .replaceAll('</style', '<\\/style')

const launchGuard = `
    <script>
      (() => {
        const showLaunchHelp = (detail = '') => {
          const app = document.getElementById('app')
          if (!app || app.childElementCount > 0) return
          app.innerHTML = '<main style="max-width:720px;margin:72px auto;padding:32px;font-family:PingFang SC,Microsoft YaHei,sans-serif;color:#142d3d;line-height:1.75"><h1 style="font-size:30px;margin:0 0 16px">课程没有正常启动</h1><p>浏览器限制了本地页面功能。请回到课程文件夹，双击 <strong>打开课程.command</strong>，系统会通过安全的本地地址打开完整课程。</p>' + (detail ? '<p style="color:#70818a;font-size:14px;overflow-wrap:anywhere">诊断信息：' + detail.replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' })[character]) + '</p>' : '') + '</main>'
        }
        window.addEventListener('error', (event) => showLaunchHelp(event.message || '本地脚本加载失败'))
        window.setTimeout(() => showLaunchHelp('页面在 2 秒内未完成初始化'), 2000)
      })()
    </script>`

const desktopLauncher = patched
  .replace('name="course-service-worker" content="./sw.js"', 'name="course-service-worker" content=""')
  .replace('name="course-lab-base" content="./labs/"', 'name="course-lab-base" content="./dist/labs/"')
  .replace('    <link rel="manifest" href="./manifest.webmanifest" />\n', '')
  .replace(styleMatch[0], () => `<style>${safeInlineStyle}</style>`)
  .replace(scriptMatch[0], '')
  .replace('</head>', () => `${launchGuard}\n  </head>`)
  .replace('</body>', () => `    <script>${safeInlineScript}</script>\n  </body>`)

// String.prototype.replace interprets $&, $` and $' in replacement strings.
// The minified Vue bundle contains those token sequences, so dynamic replacements
// must use functions; otherwise HTML tags can be injected into JavaScript.
if (/\bimport\.meta\b|\bimport\s*\(/.test(safeInlineScript)) {
  throw new Error('生产脚本仍包含只能由模块加载器处理的动态资源，无法安全生成离线单文件。')
}
if (/url\((['"]?)\.\//.test(safeInlineStyle)) {
  throw new Error('生产样式仍包含外部相对资源，无法安全生成真正的离线单文件。')
}
new Script(safeInlineScript, { filename: 'embedded-course.js' })

await Promise.all([
  writeFile(distOutputPath, original),
  writeFile(rootOutputPath, desktopLauncher),
])
await unlink(sourceOutputPath)
console.log('已生成内嵌脚本与样式、可直接双击打开的 index.html')
