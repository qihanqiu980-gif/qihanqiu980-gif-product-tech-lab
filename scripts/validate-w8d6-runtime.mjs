import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.env.W8D6_RUNTIME_URL ?? 'http://127.0.0.1:4318/course-source.html#/lesson/W8D6'
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
  const userDataDir = await mkdtemp(join(tmpdir(), `w8d6-runtime-${width}-`))
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
    await waitForText(page, '生成每日业务摘要')
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
          retell.value = '输入契约先决定入口，清洗规则先整理原始记录，指标快照再把状态压成可复核数字。'
          retell.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        retellButton?.click()
        await waitFrame()
        const observerSelect = q('.system-console select')
        const runButton = qa('.system-console button').find((button) => text(button).includes('运行并追加记录'))
        if (observerSelect && runButton) {
          observerSelect.value = 'input-contract'
          observerSelect.dispatchEvent(new Event('change', { bubbles: true }))
          await waitFrame()
          runButton.click()
          await waitFrame()
        }
        const guidedPanel = q('.lab-panel')
        const prediction = guidedPanel?.querySelector('textarea[aria-label="自动摘要实验预测"]')
        if (prediction) {
          prediction.value = '先看输入契约，再看清洗规则、指标快照和文本模板。'
          prediction.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        const saveButton = [...(guidedPanel?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存引导实验尝试'))
        guidedPanel?.querySelectorAll('.lab-steps input[type="checkbox"]').forEach((item) => item.click())
        guidedPanel?.querySelectorAll('.check-list input[type="checkbox"]').forEach((item) => item.click())
        saveButton?.click()
        await waitFrame()
        const deliverableArea = q('textarea[aria-label="自动摘要脚本 Markdown 草稿"]')
        if (deliverableArea) {
          deliverableArea.value = [
            '# daily-summary-script.py',
            'script_id: daily-summary-script.py',
            'summary_id: daily-summary-2026-08-27.md',
            'input_source: sample/daily_feed.csv',
            'cleaning_rule: normalize dates and skip rows with missing amount',
            'metric_snapshot: row_count=24; valid_count=21; total_amount=12840',
            'summary_template: fixed four-section markdown',
            'output_target: summary/daily-summary-2026-08-27.md',
            'run_command: python scripts/daily-summary-script.py --source sample/daily_feed.csv --out summary/daily-summary-2026-08-27.md',
            'run_log: teaching simulation, one skipped row',
            'evidence_limit: only proves local teaching simulation',
            'can_prove: repeated runs with same input produce same class of summary',
            'cannot_prove: real production automation is already deployed',
            'next_step: W9D1',
          ].join('\\n')
          deliverableArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        qa('.deliverable-panel .check-list input[type="checkbox"]').forEach((item) => item.click())
        const deliverableButton = [...(q('.deliverable-panel')?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('校验并保存自动摘要脚本'))
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
    assert.ok(String(value.headline ?? '').includes('自动摘要首教'))
    assert.ok(String(value.cover ?? '').includes('两时段'))
    assert.ok(String(value.deliverableText ?? '').includes('自动摘要脚本'))
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
  dayId: 'W8D6',
  viewports: viewports.length,
  status: 'ok',
}, null, 2))
