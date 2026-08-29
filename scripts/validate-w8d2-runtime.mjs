import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.env.W8D2_RUNTIME_URL ?? 'http://127.0.0.1:4318/course-source.html#/lesson/W8D2'
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
  const port = 9820 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w8d2-runtime-${width}-`))
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
    await waitForText(page, '从输入到输出')
    const result = await page.send('Runtime.evaluate', {
      returnByValue: true,
      awaitPromise: true,
      expression: `(async () => {
        const text = (node) => node?.textContent?.replace(/\\s+/g, ' ').trim() || ''
        const q = (selector) => document.querySelector(selector)
        const qa = (selector) => [...document.querySelectorAll(selector)]
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
        const retell = firstChapter?.querySelector('textarea[aria-label="第 1 章复述"]')
        const retellButton = [...(firstChapter?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存复述为待复核'))
        if (retell) {
          retell.value = '输入契约先决定入口，原始值先被接住，变量接力和转换再把状态传下去。'
          retell.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        retellButton?.click()
        await waitFrame()
        const observerSelect = q('.system-console select')
        const runButton = qa('.system-console button').find((button) => text(button).includes('运行并追加记录'))
        if (observerSelect && runButton) {
          observerSelect.value = 'raw-input'
          observerSelect.dispatchEvent(new Event('change', { bubbles: true }))
          await waitFrame()
          runButton.click()
          await waitFrame()
        }
        const guidedPanel = q('.lab-panel')
        const prediction = guidedPanel?.querySelector('textarea[aria-label="输入到输出实验预测"]')
        if (prediction) {
          prediction.value = '先看输入契约，再看原始值、变量接力和判断路径。'
          prediction.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        const saveButton = [...(guidedPanel?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存引导实验尝试'))
        guidedPanel?.querySelectorAll('.lab-steps input[type="checkbox"]').forEach((item) => item.click())
        guidedPanel?.querySelectorAll('.check-list input[type="checkbox"]').forEach((item) => item.click())
        saveButton?.click()
        await waitFrame()
        const deliverableArea = q('textarea[aria-label="执行流程图 Markdown 草稿"]')
        if (deliverableArea) {
          deliverableArea.value = [
            '# execution-flow-diagram.md',
            'flow_id: w8d2-order-summary-flow',
            'input_source: form payload',
            'raw_value: "0080"',
            'state_variable: clean_amount',
            'transform_step: trim then parse number',
            'decision_path: amount > threshold',
            'output_target: summary text',
            'can_prove: path from input to output',
            'cannot_prove: real business result is already correct',
            'next_step: W8D3',
          ].join('\\n')
          deliverableArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        qa('.deliverable-panel .check-list input[type="checkbox"]').forEach((item) => item.click())
        const deliverableButton = [...(q('.deliverable-panel')?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('校验并保存执行流程图'))
        deliverableButton?.click()
        await waitFrame()
        return {
          headline: text(q('.course-protocol')),
          cover: text(q('.cover-summary')),
          route: text(q('.w1-route-note')),
          announcement: text(q('.announcement')),
          deliverableText: text(q('.deliverable-panel')),
        }
      })()`,
    })
    const value = result.result.value ?? {}
    assert.ok(String(value.headline ?? '').includes('输入到输出首教'))
    assert.ok(String(value.cover ?? '').includes('两时段'))
    assert.ok(String(value.deliverableText ?? '').includes('执行流程图'))
    assert.ok(String(value.announcement ?? '').length > 0)
    return value
  } finally {
    await stopChrome(chrome, userDataDir)
  }
}

for (const [index, width] of viewports.entries()) {
  await validateViewport(width, index)
}

console.log(JSON.stringify({
  dayId: 'W8D2',
  viewports: viewports.length,
  status: 'ok',
}, null, 2))
