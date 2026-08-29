import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.env.W4D2_RUNTIME_URL ?? 'http://127.0.0.1:4318/#/lesson/W4D2'
const courseUrl = process.env.W4D2_COURSE_ROUTE_URL ?? new URL('#/course', url).href
const viewports = [1440, 1024, 860, 390, 320]
const aggregationScenarios = ['exposed-users-count', 'same-day-payment-rate', 'rolling-24h-window', 'unique-paid-orders', 'average-vs-median', 'group-having-gate']

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
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
}

async function validateViewport(width, index) {
  const port = 9520 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w4d2-runtime-${width}-`))
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
    await new Promise((resolve) => setTimeout(resolve, 900))
    const result = await page.send('Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: `(async () => {
        const text = (node) => node?.textContent?.replace(/\\s+/g, ' ').trim() || ''
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
        firstChapter?.querySelector('.learn-toggle')?.click()
        const firstRadio = firstChapter?.querySelector('fieldset input[type="radio"][value="0"]')
        if (firstRadio) {
          firstRadio.checked = true
          firstRadio.dispatchEvent(new Event('change', { bubbles: true }))
        }
        clickByText('.checkpoint-actions button', '检查本章练习')
        firstChapter?.querySelector('.reset-link')?.click()
        await new Promise((resolve) => setTimeout(resolve, 80))
        const retellTextarea = firstChapter?.querySelector('textarea[aria-label="第 1 章复述"], .retell-field textarea')
        const retellButton = [...(firstChapter?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存复述'))
        const retellStatus = () => text(firstChapter?.querySelector('.checkpoint-footer strong'))
        const setRetell = (value) => {
          if (!retellTextarea) return
          retellTextarea.value = value
          retellTextarea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        setRetell('哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈哈')
        retellButton?.click()
        await new Promise((resolve) => setTimeout(resolve, 80))
        const retellAfterFirstWrong = {
          status: retellStatus(),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
          feedback: text(firstChapter?.querySelector('.retell-feedback')),
        }
        retellButton?.click()
        await new Promise((resolve) => setTimeout(resolve, 80))
        const retellAfterSecondWrong = {
          status: retellStatus(),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
          answer: text(firstChapter?.querySelector('.retell-answer')),
          announcement: text(q('.announcement')),
        }
        setRetell('W4D2 要先固定输入行，再让 COUNT DISTINCT SUM AVG 等聚合函数只计算本地教学样本，不能提前写成真实生产结论或 JOIN 结果。')
        retellButton?.click()
        await new Promise((resolve) => setTimeout(resolve, 80))
        const retellAfterValid = {
          status: retellStatus(),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
          announcement: text(q('.announcement')),
        }
        const observerSelect = q('.system-console select')
        const runButton = qa('.system-console button').find((button) => text(button).includes('运行并追加记录'))
        for (const value of ${JSON.stringify(aggregationScenarios)}) {
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
        const bodyText = text(document.body)
        return {
          href: location.href,
          innerWidth,
          device: q('.day01-course')?.getAttribute('data-device'),
          title: text(q('h1')),
          navCurrent: text(q('.w1-global-nav .is-current')),
          chapterCount: qa('.framework-chapter').length,
          routeItems: qa('.w1-route-item').length,
          desktopRoutePosition: desktopRouteStyle.position,
          desktopRouteOverflow: desktopRouteStyle.overflow,
          mobileRouteOverflow: mobileRouteListStyle.overflow,
          mobileRouteMaxHeight: mobileRouteListStyle.maxHeight,
          hasToolbar: Boolean(q('.daily-course-toolbar, .duration-switch')) || visibleTextIncludes('button, a, header, nav, aside, main, section', '返回课程路线'),
          mainCanvasOnly: Boolean(mainCanvas) && getComputedStyle(q('.w1-main')).overflowY !== 'auto' && desktopRouteStyle.overflow === 'visible',
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          retellAfterFirstWrong,
          retellAfterSecondWrong,
          retellAfterValid,
          consoleCommands: qa('.exchange-history code').map((node) => text(node)),
          hasAggregationSample: bodyText.includes('aggregation-logic.md') && bodyText.includes('aggregation_id') && bodyText.includes('metric_ref') && bodyText.includes('input_rows') && bodyText.includes('where_rule') && bodyText.includes('aggregate_function') && bodyText.includes('distinct_key') && bodyText.includes('group_key') && bodyText.includes('having_rule') && bodyText.includes('result_value') && bodyText.includes('edge_case') && bodyText.includes('COUNT') && bodyText.includes('DISTINCT') && bodyText.includes('SUM') && bodyText.includes('AVG') && bodyText.includes('GROUP BY') && bodyText.includes('HAVING') && bodyText.includes('U03') && bodyText.includes('O05') && bodyText.includes('O06') && bodyText.includes('W4D3') && bodyText.includes('不能证明'),
          ariaStates: qa('.w1-route-state').every((item) => item.getAttribute('aria-label')?.match(/学习|练习|复述/)),
        }
      })()`,
    })
    const value = result.result.value ?? {}
    assert.equal(String(value.title ?? ''), '聚合与分组入门', `${width}: W4D2 深链未打开完整课程`)
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
    assert.equal(value.retellAfterFirstWrong?.status, '1/3', `${width}: 第一次乱填复述不应完成`)
    assert.equal(value.retellAfterFirstWrong?.answerVisible, false, `${width}: 第一次复述错误不应显示参考答案`)
    assert.match(value.retellAfterFirstWrong?.feedback ?? '', /先不显示参考答案/, `${width}: 第一次错误必须提示先按量规补齐`)
    assert.equal(value.retellAfterSecondWrong?.status, '1/3', `${width}: 第二次乱填复述仍不应完成`)
    assert.equal(value.retellAfterSecondWrong?.answerVisible, true, `${width}: 第二次复述错误后必须显示参考答案`)
    assert.match(value.retellAfterSecondWrong?.answer ?? '', /参考答案[\s\S]*输入行[\s\S]*聚合/, `${width}: 第二次错误后的参考答案缺少 W4D2 核心要点`)
    assert.equal(value.retellAfterValid?.status, '2/3', `${width}: 合格复述应只把复述项保存为待复核`)
    assert.equal(value.retellAfterValid?.answerVisible, false, `${width}: 合格复述后参考答案应收起`)
    assert.match(value.retellAfterValid?.announcement ?? '', /复述通过核验[\s\S]*待复核/, `${width}: 合格复述必须明确通过核验但仍待复核`)
    assert.equal(value.hasAggregationSample, true, `${width}: W4D2 没有展示聚合字段、样例或边界`)
    assert.equal(value.consoleCommands.length, aggregationScenarios.length, `${width}: 六条聚合路径未全部追加`)
    assert.deepEqual(value.consoleCommands.map((item) => item.split('|')[1]), aggregationScenarios, `${width}: 六条聚合路径顺序或名称错误`)
    return value
  } finally {
    await stopChrome(chrome, userDataDir)
  }
}

async function validateCourseRouteEntry(width, index) {
  const port = 9580 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w4d2-course-route-${width}-`))
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
        const entry = qa('button').find((button) => isVisible(button) && (text(button).includes('W4D2') || text(button).includes('聚合与分组入门')))
        entry?.click()
        await new Promise((resolve) => setTimeout(resolve, 350))
        const bodyText = text(document.body)
        return {
          href: location.href,
          entryFound: Boolean(entry),
          title: text(q('h1')),
          navCurrent: text(q('.w1-global-nav .is-current')),
          chapterCount: qa('.framework-chapter').length,
          bodyText,
        }
      })()`,
    })
    const value = result.result.value ?? {}
    const bodyText = String(value.bodyText ?? '')
    assert.equal(value.entryFound, true, `${width}: 课程路线中找不到 W4D2 入口`)
    assert.equal(String(value.title ?? ''), '聚合与分组入门', `${width}: 课程路线点击后未打开 W4D2`)
    assert.equal(value.navCurrent, '课程', `${width}: 左侧全局学习栏课程未激活`)
    assert.equal(value.chapterCount, 7, `${width}: 课程路线打开后主正文不是七章`)
    assert.ok(bodyText.includes('aggregation-logic.md') && bodyText.includes('W4D3'), `${width}: 课程路线打开后缺少 W4D2 样例或下一步边界`)
    return value
  } finally {
    await stopChrome(chrome, userDataDir)
  }
}

for (const [index, width] of viewports.entries()) {
  await validateViewport(width, index)
  await validateCourseRouteEntry(width, index)
}

console.log(JSON.stringify({ dayId: 'W4D2', viewports, ok: true }, null, 2))
