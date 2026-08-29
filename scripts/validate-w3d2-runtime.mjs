import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.env.W3D2_RUNTIME_URL ?? 'http://127.0.0.1:4318/#/lesson/W3D2'
const courseUrl = process.env.W3D2_COURSE_ROUTE_URL ?? new URL('#/course', url).href
const viewports = [1440, 1024, 860, 390, 320]

async function waitForJson(port, retries = 80) {
  for (let index = 0; index < retries; index += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (response.ok) return response.json()
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Chrome CDP ${port} did not become ready`)
}

async function connectPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
  const target = await response.json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const waiters = new Map()
  const events = []
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && waiters.has(message.id)) {
      const { resolve, reject } = waiters.get(message.id)
      waiters.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result ?? {})
      return
    }
    if (message.method) events.push(message)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const currentId = ++id
    waiters.set(currentId, { resolve, reject })
    ws.send(JSON.stringify({ id: currentId, method, params }))
  })
  return { ws, send, events }
}

async function stopChrome(chrome, userDataDir) {
  if (!chrome.killed) chrome.kill('SIGKILL')
  await new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      resolve()
      return
    }
    chrome.once('exit', resolve)
  })
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
      return
    } catch (error) {
      if (attempt === 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
}

async function validateViewport(width, index) {
  const port = 9420 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w3d2-runtime-${width}-`))
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},920`,
    'about:blank',
  ], { stdio: 'ignore' })
  try {
    await waitForJson(port)
    const page = await connectPage(port)
    await page.send('Page.enable')
    await page.send('Runtime.enable')
    await page.send('Log.enable')
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 920, deviceScaleFactor: 1, mobile: width <= 860 })
    const load = new Promise((resolve) => {
      const timer = setInterval(() => {
        if (page.events.some((event) => event.method === 'Page.loadEventFired')) {
          clearInterval(timer)
          resolve()
        }
      }, 50)
    })
    await page.send('Page.navigate', { url })
    await load
    await new Promise((resolve) => setTimeout(resolve, 350))
    const result = await page.send('Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: `(async () => {
        const text = (node) => node?.textContent?.trim() || ''
        const q = (selector) => document.querySelector(selector)
        const qa = (selector) => [...document.querySelectorAll(selector)]
        const isVisible = (node) => {
          if (!node) return false
          const style = getComputedStyle(node)
          const rect = node.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        }
        const visibleTextIncludes = (selector, label) => qa(selector).some((node) => isVisible(node) && text(node).includes(label))
        const clickByText = (selector, label) => {
          const element = qa(selector).find((item) => text(item).includes(label))
          if (!element) return false
          element.click()
          return true
        }
        const firstChapter = q('.framework-chapter')
        const firstLearn = firstChapter?.querySelector('.learn-toggle')
        firstLearn?.click()
        const firstRadio = firstChapter?.querySelector('fieldset input[type="radio"][value="0"]')
        if (firstRadio) {
          firstRadio.checked = true
          firstRadio.dispatchEvent(new Event('change', { bubbles: true }))
        }
        clickByText('.checkpoint-actions button', '检查本章练习')
        const firstReset = firstChapter?.querySelector('.reset-link')
        firstReset?.click()
        const observerSelect = q('.system-console select')
        const runButton = qa('.system-console button').find((button) => text(button).includes('运行并追加记录'))
        for (const value of ['missing-from', 'where-before-source', 'select-column-mismatch', 'order-without-rule', 'limit-overclaim', 'qualified-select-order']) {
          if (observerSelect && runButton) {
            observerSelect.value = value
            observerSelect.dispatchEvent(new Event('change', { bubbles: true }))
            await new Promise((resolve) => setTimeout(resolve, 30))
            runButton.click()
            await new Promise((resolve) => setTimeout(resolve, 40))
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 120))
        const mainCanvas = q('.main-canvas')
        const desktopRouteStyle = getComputedStyle(q('.w1-route'))
        const mobileRouteListStyle = getComputedStyle(q('.w1-mobile-route .w1-route-list'))
        const device = q('.day01-course')?.getAttribute('data-device')
        const routeItems = qa('.w1-route-item')
        const chapterCount = qa('.framework-chapter').length
        const consoleCommands = qa('.exchange-history code').map((node) => text(node))
        return {
          href: location.href,
          innerWidth,
          device,
          title: text(q('h1')),
          navCurrent: text(q('.w1-global-nav .is-current')),
          chapterCount,
          routeItems: routeItems.length,
          desktopRoutePosition: desktopRouteStyle.position,
          desktopRouteOverflow: desktopRouteStyle.overflow,
          mobileRouteOverflow: mobileRouteListStyle.overflow,
          mobileRouteMaxHeight: mobileRouteListStyle.maxHeight,
          hasToolbar: Boolean(q('.daily-course-toolbar, .duration-switch')) || visibleTextIncludes('button, a, header, nav, aside, main, section', '返回课程路线'),
          mainCanvasOnly: Boolean(mainCanvas) && getComputedStyle(q('.w1-main')).overflowY !== 'auto' && desktopRouteStyle.overflow === 'visible',
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          activeLearnAfterReset: firstChapter?.querySelector('.w1-route-state.is-done')?.textContent || '',
          consoleCommands,
          coverageCount: consoleCommands.length,
          ariaStates: qa('.w1-route-state').every((item) => item.getAttribute('aria-label')?.match(/学习|练习|复述/)),
        }
      })()`,
    })
    const value = result.result.value
    assert.equal(value.title, 'SELECT 执行逻辑', `${width}: W3D2 深链未打开完整课程`)
    assert.equal(value.navCurrent, '课程', `${width}: 左侧全局学习栏课程未激活`)
    assert.equal(value.chapterCount, 7, `${width}: 主正文不是七章`)
    assert.ok(value.routeItems >= 14, `${width}: 桌面和移动七章目录未共同渲染`)
    assert.equal(value.hasToolbar, false, `${width}: 出现外置返回/时长工具栏`)
    assert.equal(value.desktopRoutePosition, 'sticky', `${width}: 桌面目录不是 sticky`)
    assert.equal(value.desktopRouteOverflow, 'visible', `${width}: 桌面目录产生内部滚动`)
    assert.equal(value.mobileRouteOverflow, 'visible', `${width}: 移动目录产生内部滚动`)
    assert.equal(value.mobileRouteMaxHeight, 'none', `${width}: 移动目录被视口高度裁切`)
    assert.equal(value.horizontalOverflow, false, `${width}: 页面级横向溢出`)
    assert.equal(value.mainCanvasOnly, true, `${width}: 主滚动合同不成立`)
    assert.equal(value.ariaStates, true, `${width}: 目录状态缺少可访问名称`)
    assert.equal(value.coverageCount, 6, `${width}: 六路径观察器未全部追加`)
    assert.deepEqual(value.consoleCommands.map((item) => item.split('|')[1]), ['missing-from', 'where-before-source', 'select-column-mismatch', 'order-without-rule', 'limit-overclaim', 'qualified-select-order'], `${width}: 六路径顺序或名称错误`)
    return value
  } finally {
    await stopChrome(chrome, userDataDir)
  }
}

async function validateCourseRouteEntry(width, index) {
  const port = 9480 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w3d2-course-route-${width}-`))
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${width},920`,
    'about:blank',
  ], { stdio: 'ignore' })
  try {
    await waitForJson(port)
    const page = await connectPage(port)
    await page.send('Page.enable')
    await page.send('Runtime.enable')
    await page.send('Log.enable')
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 920, deviceScaleFactor: 1, mobile: width <= 860 })
    const load = new Promise((resolve) => {
      const timer = setInterval(() => {
        if (page.events.some((event) => event.method === 'Page.loadEventFired')) {
          clearInterval(timer)
          resolve()
        }
      }, 50)
    })
    await page.send('Page.navigate', { url: courseUrl })
    await load
    await new Promise((resolve) => setTimeout(resolve, 350))
    const result = await page.send('Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: `(async () => {
        localStorage.clear()
        const text = (node) => node?.textContent?.replace(/\\s+/g, ' ').trim() || ''
        const q = (selector) => document.querySelector(selector)
        const qa = (selector) => [...document.querySelectorAll(selector)]
        const isVisible = (node) => {
          if (!node) return false
          const style = getComputedStyle(node)
          const rect = node.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
        }
        const entry = qa('button').find((button) => isVisible(button) && (text(button).includes('W3D2') || text(button).includes('SELECT 执行逻辑')))
        entry?.click()
        await new Promise((resolve) => setTimeout(resolve, 350))
        const bodyText = text(document.body)
        return {
          href: location.href,
          entryFound: Boolean(entry),
          title: text(q('h1')),
          navCurrent: text(q('.w1-global-nav .is-current')),
          chapterCount: qa('.framework-chapter').length,
          lockedOrMissing: bodyText.includes('未解锁') || bodyText.includes('内容缺失') || bodyText.includes('实现待审核'),
          routeItems: qa('.w1-route-item').length,
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
        }
      })()`,
    })
    const value = result.result.value
    assert.equal(value.entryFound, true, `${width}: 课程路线中必须能找到 W3D2 入口`)
    assert.match(value.href, /#\/lesson\/W3D2$/, `${width}: 点击课程路线入口后未进入 W3D2 深链`)
    assert.equal(value.title, 'SELECT 执行逻辑', `${width}: 课程路线入口未打开 W3D2 完整课程`)
    assert.equal(value.navCurrent, '课程', `${width}: 从课程路线进入 W3D2 后课程导航未激活`)
    assert.equal(value.chapterCount, 7, `${width}: 从课程路线进入 W3D2 后不是七章正文`)
    assert.equal(value.lockedOrMissing, false, `${width}: W3D2 入口被缺课或锁定页替代`)
    assert.ok(value.routeItems >= 14, `${width}: 从课程路线进入 W3D2 后目录未完整渲染`)
    assert.equal(value.horizontalOverflow, false, `${width}: 课程路线进入 W3D2 后页面级横向溢出`)
    return value
  } finally {
    await stopChrome(chrome, userDataDir)
  }
}

const results = []
for (const [index, width] of viewports.entries()) {
  results.push(await validateViewport(width, index))
}
const routeResults = []
for (const [index, width] of [1440, 390].entries()) {
  routeResults.push(await validateCourseRouteEntry(width, index))
}

console.log(JSON.stringify({
  url,
  courseUrl,
  viewports: results.map(({ innerWidth, device, chapterCount, routeItems, coverageCount, horizontalOverflow }) => ({ innerWidth, device, chapterCount, routeItems, coverageCount, horizontalOverflow })),
  routeEntries: routeResults.map(({ href, title, navCurrent, chapterCount, routeItems, horizontalOverflow }) => ({ href, title, navCurrent, chapterCount, routeItems, horizontalOverflow })),
}, null, 2))
