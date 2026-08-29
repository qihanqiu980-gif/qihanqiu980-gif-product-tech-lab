import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.env.W8D1_RUNTIME_URL ?? 'http://127.0.0.1:4318/course-source.html#/lesson/W8D1'
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

async function waitForText(page, expectedText, timeoutMs = 15000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const result = await page.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `({
        body: document.body?.innerText || '',
        href: location.href
      })`,
    })
    const value = result.result.value ?? {}
    if (String(value.body ?? '').includes(expectedText)) return value
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`Lesson did not become ready: ${expectedText}`)
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
  const port = 9720 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w8d1-runtime-${width}-`))
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
    await page.send('Page.navigate', { url })
    await waitForText(page, '程序如何表达步骤')
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
        const clickByText = (selector, label) => {
          const element = qa(selector).find((item) => text(item).includes(label))
          if (!element) return false
          element.click()
          return true
        }
        const waitFrame = () => new Promise((resolve) => setTimeout(resolve, 80))
        const firstChapter = q('[data-framework-chapter="chapter-1"]')
        const firstLearn = firstChapter?.querySelector('.learn-toggle')
        firstLearn?.click()
        await waitFrame()
        const firstRadio = firstChapter?.querySelector('fieldset input[type="radio"][value="0"]')
        firstRadio?.click()
        await waitFrame()
        firstChapter?.querySelector('.checkpoint-actions button')?.click()
        await waitFrame()
        const chapterOneRetell = firstChapter?.querySelector('textarea[aria-label="第 1 章复述"]')
        const chapterOneRetellButton = [...(firstChapter?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存复述为待复核'))
        const chapterOneStatus = () => text(firstChapter?.querySelector('.checkpoint-footer strong'))
        const setRetell = (node, value) => {
          if (!node) return
          node.value = value
          node.dispatchEvent(new Event('input', { bubbles: true }))
        }
        setRetell(chapterOneRetell, '入口和语句顺序必须先看，输出不能直接当证明。')
        await waitFrame()
        chapterOneRetellButton?.click()
        await waitFrame()
        const retellAfterFirstWrong = {
          status: chapterOneStatus(),
          feedback: text(firstChapter?.querySelector('.retell-feedback')),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
        }
        chapterOneRetellButton?.click()
        await waitFrame()
        const retellAfterSecondWrong = {
          status: chapterOneStatus(),
          feedback: text(firstChapter?.querySelector('.retell-feedback')),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
          answer: text(firstChapter?.querySelector('.retell-answer')),
        }
        setRetell(chapterOneRetell, 'W8D1 先看入口和语句顺序，再区分输入输出与变量赋值；输出只能说明脚本走到了终点，不能证明真实自动化、JSON、CSV 或后续课程已完成。')
        await waitFrame()
        chapterOneRetellButton?.click()
        await waitFrame()
        const retellAfterPass = {
          status: chapterOneStatus(),
          feedback: text(firstChapter?.querySelector('.retell-feedback')),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
          announcement: text(q('.announcement')),
        }
        const firstReset = firstChapter?.querySelector('.reset-link')
        firstReset?.click()
        await waitFrame()
        const afterReset = {
          status: chapterOneStatus(),
          answerVisible: isVisible(firstChapter?.querySelector('.retell-answer')),
          feedback: text(firstChapter?.querySelector('.retell-feedback')),
        }
        const observerSelect = q('.system-console select')
        const runButton = qa('.system-console button').find((button) => text(button).includes('运行并追加记录'))
        for (const value of ['entry-input', 'assignment-conversion', 'branch-condition', 'loop-iteration', 'function-output', 'qualified-annotation']) {
          if (observerSelect && runButton) {
            observerSelect.value = value
            observerSelect.dispatchEvent(new Event('change', { bubbles: true }))
            await new Promise((resolve) => setTimeout(resolve, 30))
            runButton.click()
            await new Promise((resolve) => setTimeout(resolve, 40))
          }
        }
        const guidedPanel = q('.lab-panel')
        const guidedPrediction = guidedPanel?.querySelector('textarea[aria-label="代码结构标注实验预测"]')
        const guidedRecordAreas = [...(guidedPanel?.querySelectorAll('.record-grid textarea') ?? [])]
        const guidedStepChecks = [...(guidedPanel?.querySelectorAll('.lab-steps input[type="checkbox"]') ?? [])]
        const guidedPassChecks = [...(guidedPanel?.querySelectorAll('.check-list input[type="checkbox"]') ?? [])]
        const guidedSaveButton = [...(guidedPanel?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存引导实验尝试'))
        setRetell(guidedPrediction, '先把入口、赋值、转换、分支、循环和函数边界分开，再判断哪些步骤会变。')
        guidedRecordAreas.forEach((area, index) => setRetell(area, '记录 ' + (index + 1) + '：结构边界与教学模拟证据。'))
        await waitFrame()
        guidedStepChecks.forEach((item) => item.click())
        await waitFrame()
        guidedPassChecks.forEach((item) => item.click())
        await waitFrame()
        guidedSaveButton?.click()
        await waitFrame()
        const guidedAnnouncement = text(q('.announcement'))
        const guidedHistory = qa('.exchange-history code').map((node) => text(node))
        const guidedSaveReady = Boolean(guidedSaveButton) && !guidedSaveButton.disabled
        const structureTextarea = q('textarea[aria-label="代码结构标注 Markdown 草稿"]')
        const deliverableButtons = qa('.deliverable-panel button')
        const fillDeliverable = (value) => {
          if (!structureTextarea) return
          structureTextarea.value = value
          structureTextarea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const invalidDraft = [
          '# code-structure-annotation.md',
          'step_id: 1',
          'statement_or_block: entry',
          'role: 入口与输入',
          'input: Python 脚本与命令行参数',
          'output: 终端输出',
          'boundary: 教学模拟边界',
          'can_prove: 结构层能证明入口和顺序',
          'cannot_prove: 不能证明真实自动化已上线',
          'next_step: W8D2',
        ].join('\\n')
        fillDeliverable(invalidDraft)
        deliverableButtons.find((button) => text(button).includes('校验并保存代码结构标注'))?.click()
        const validDraft = [
          '# code-structure-annotation.md',
          '',
          'step_id: 1',
          'statement_or_block: entry-input',
          'role: Python 运行边界与语句顺序',
          'input: Python 解释器与脚本入口',
          'output: 运行后的打印结果',
          'boundary: 教学模拟',
          'can_prove: 结构层能证明入口和顺序',
          'cannot_prove: 不能证明真实自动化或生产结果',
          'next_step: W8D2',
        ].join('\\n')
        fillDeliverable(validDraft)
        qa('.deliverable-panel .check-list input[type="checkbox"]').forEach((item) => item.click())
        deliverableButtons.find((button) => text(button).includes('校验并保存代码结构标注'))?.click()
        const memoryArea = q('textarea[aria-label="W8D1 最终闭卷解释"]')
        const microArea = q('textarea[aria-label="W8D1 记忆微操作"]')
        const unresolvedArea = q('textarea[aria-label="W8D1 未解决问题"]')
        if (memoryArea) {
          memoryArea.value = 'Python 脚本先从入口开始，按语句顺序推进，输入把外部数据带进来，变量接住当前值，类型转换把字符串和数字分开，分支、循环和函数再改变路径或复用步骤。W8D1 只证明结构怎样表达步骤，不能证明真实自动化、JSON、CSV、文件批处理或业务结果已经正确。'
          memoryArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        if (microArea) {
          microArea.value = '在 5 行伪代码旁边标出入口、赋值、转换、分支、循环、函数和输出。'
          microArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        if (unresolvedArea) {
          unresolvedArea.value = '先区分输入边界和输出边界。'
          unresolvedArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const learnAnchors = q('.memory-panel .check-list')
        qa('.memory-panel .check-list input[type="checkbox"]').forEach((item) => item.click())
        qa('.review-timeline input[type="checkbox"]').forEach((item) => item.click())
        q('.memory-panel button')?.click()
        const chapterSeven = q('[data-framework-chapter="chapter-7"]')
        chapterSeven?.querySelector('.learn-toggle')?.click()
        await waitFrame()
        const chapterPractice = chapterSeven?.querySelector('fieldset input[type="radio"][value="0"]')
        chapterPractice?.click()
        await waitFrame()
        chapterSeven?.querySelector('.checkpoint-actions button')?.click()
        await waitFrame()
        const retellArea = chapterSeven?.querySelector('textarea[aria-label="第 7 章复述"]')
        const saveRetellButton = [...(chapterSeven?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存复述为待复核'))
        const setTextareaValue = (value) => {
          if (!retellArea) return
          retellArea.value = value
          retellArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        setTextareaValue('八个概念都能说到：入口、语句顺序、输入输出、变量、类型转换、分支、循环和函数边界一起决定脚本怎样表达步骤；字段齐全，包含 step_id、statement_or_block、role、input、output、boundary、can_prove、cannot_prove 和 next_step。没有越界到后续课程：它只证明教学模拟中的结构标注，不能证明真实自动化、JSON、CSV、文件批处理或生产结果已经成立。')
        await waitFrame()
        saveRetellButton?.click()
        await waitFrame()
        const mobileRouteToggle = q('.w1-mobile-route summary')
        mobileRouteToggle?.click()
        const mobileRouteItems = qa('.w1-mobile-route .w1-route-item').map((button) => text(button))
        q('.w1-route .w1-route-group .w1-route-item')?.click()
        const routeButtons = qa('.w1-route .w1-route-item')
        routeButtons.at(-1)?.click()
        const routeStateLabels = qa('.w1-route-state').map((node) => node.getAttribute('aria-label') || '')
        const desktopRouteStyle = getComputedStyle(q('.w1-route'))
        const mobileRouteListStyle = getComputedStyle(q('.w1-mobile-route .w1-route-list'))
        const chapterCount = qa('.framework-chapter').length
        const routeItems = qa('.w1-route-item').length
        const progressText = text(q('.cover-evidence'))
        return {
          href: location.href,
          innerWidth,
          device: q('.day01-course')?.getAttribute('data-device'),
          title: text(q('h1')),
          navCurrent: text(q('.w1-global-nav .is-current')),
          chapterCount,
          routeItems,
          desktopRoutePosition: desktopRouteStyle.position,
          desktopRouteOverflow: desktopRouteStyle.overflow,
          mobileRouteOverflow: mobileRouteListStyle.overflow,
          mobileRouteMaxHeight: mobileRouteListStyle.maxHeight,
          hasToolbar: Boolean(q('.daily-course-toolbar, .duration-switch')) || [...qa('button, a, header, nav, aside, main, section')].some((node) => isVisible(node) && text(node).includes('返回课程路线')),
          mainCanvasOnly: Boolean(q('.main-canvas')) && q('.main-canvas').scrollHeight > q('.main-canvas').clientHeight && getComputedStyle(q('.main-canvas')).overflowX === 'hidden',
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 || document.body.scrollWidth > document.body.clientWidth + 1,
          routeStateLabels,
          mobileRouteItems,
          progressText,
          guidedAnnouncement,
          guidedHistory,
          guidedSaveReady,
          retellAfterFirstWrong,
          retellAfterSecondWrong,
          retellAfterPass,
          afterReset,
          retellVisible: isVisible(q('[data-framework-chapter="chapter-7"] .retell-answer')),
          announcement: text(q('.announcement')),
          deliverableGate: text(q('.deliverable-panel .counter')),
          deliverableFields: qa('.deliverable-panel .simulation-coverage .done').map((node) => text(node)),
          memorySummary: text(q('.memory-panel')),
        }
      })()`,
    })
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? 'unknown error'
      throw new Error(`${width}: runtime expression failed: ${description}`)
    }
    const value = result.result.value ?? {}
    assert.equal(String(value.title ?? ''), '程序如何表达步骤', `${width}: W8D1 深链未打开完整课程`)
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
    assert.ok(value.routeStateLabels.every((label) => /学习|练习|复述/.test(label)), `${width}: 目录状态缺少可访问名称`)
    assert.ok(Array.isArray(value.mobileRouteItems) && value.mobileRouteItems.length === 7, `${width}: 移动端目录没有 7 个章节`)
    assert.equal(value.retellAfterFirstWrong?.status, '2/3', `${width}: 第一次不合格复述不应保存为待复核`)
    assert.equal(value.retellAfterFirstWrong?.answerVisible, false, `${width}: 第一次复述错误不应显示参考答案`)
    assert.match(value.retellAfterFirstWrong?.feedback ?? '', /先不显示参考答案/, `${width}: 第一次错误必须提示按量规补齐`)
    assert.equal(value.retellAfterSecondWrong?.status, '2/3', `${width}: 第二次不合格复述仍不应保存为待复核`)
    assert.equal(value.retellAfterSecondWrong?.answerVisible, true, `${width}: 第二次错误后必须显示参考答案`)
    assert.match(value.retellAfterSecondWrong?.answer ?? '', /参考答案[\s\S]*入口[\s\S]*顺序/, `${width}: 第二次错误后的参考答案缺少 W8D1 核心要点`)
    assert.equal(value.retellAfterPass?.status, '三项完成', `${width}: 合格复述应完成本章三项状态`)
    assert.equal(value.retellAfterPass?.answerVisible, false, `${width}: 合格复述后参考答案应收起`)
    assert.equal(value.afterReset?.status, '1/3', `${width}: 清空重做没有撤销练习和复述状态`)
    assert.equal(value.afterReset?.answerVisible, false, `${width}: 清空重做后参考答案仍可见`)
    assert.match(value.guidedAnnouncement ?? '', /代码结构标注实操证据已追加保存/, `${width}: 引导实验没有通过门槛并追加保存`)
    assert.equal(value.guidedHistory?.length, 6, `${width}: 六条代码结构观察路径未全部追加`)
    assert.deepEqual(value.guidedHistory.map((item) => item.split('|')[1]), ['entry-input', 'assignment-conversion', 'branch-condition', 'loop-iteration', 'function-output', 'qualified-annotation'], `${width}: 六条代码结构观察路径顺序或名称错误`)
    assert.match(value.progressText ?? '', /已学习|练习通过|待复核复述/, `${width}: 课程进度摘要缺少状态词`)
    assert.match(value.deliverableGate ?? '', /字段 9\/9|边界门禁 通过/, `${width}: 成果门禁没有进入通过态`)
    assert.ok((value.deliverableFields ?? []).length >= 9, `${width}: 成果字段配额未全部点亮`)
    assert.match(value.announcement ?? '', /待复核|已进入待复核/, `${width}: 复述保存后没有落入待复核状态`)
    assert.equal(value.retellVisible, false, `${width}: 第一次合格复述不应立即显示参考答案`)
    assert.match(value.memorySummary ?? '', /脚本入口与运行边界|语句顺序与输入输出|变量赋值与类型转换|控制流与函数复用/, `${width}: 记忆面板缺少 W8D1 锚点`)
    return value
  } finally {
    await stopChrome(chrome, userDataDir)
  }
}

const results = []
for (const [index, width] of viewports.entries()) {
  results.push(await validateViewport(width, index))
}

console.log(JSON.stringify({ url, viewports: results.map(({ innerWidth, device, chapterCount, routeItems, horizontalOverflow }) => ({ innerWidth, device, chapterCount, routeItems, horizontalOverflow })) }, null, 2))
