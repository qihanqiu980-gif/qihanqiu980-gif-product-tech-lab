import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.env.W5D3_RUNTIME_URL ?? 'http://127.0.0.1:4318/course-source.html#/lesson/W5D3'
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
  const port = 9940 + index
  const userDataDir = await mkdtemp(join(tmpdir(), `w5d3-runtime-${width}-`))
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
    await waitForText(page, '连接用户、行为与订单')
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
          retell.value = '先分清表角色，再按 users、events、orders 的链路逐步记录行数、唯一键和金额。'
          retell.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        retellButton?.click()
        await waitFrame()
        const observerSelect = q('.system-console select')
        const runButton = qa('.system-console button').find((button) => text(button).includes('运行并追加记录'))
        if (observerSelect && runButton) {
          observerSelect.value = 'join-users-events'
          observerSelect.dispatchEvent(new Event('change', { bubbles: true }))
          await waitFrame()
          runButton.click()
          await waitFrame()
        }
        const guidedPanel = q('.lab-panel')
        const prediction = guidedPanel?.querySelector('textarea[aria-label="多表 SQL 实验预测"]')
        if (prediction) {
          prediction.value = '先看 users 和 events 的连接，再看 orders 是否放大金额。'
          prediction.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        const saveButton = [...(guidedPanel?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('保存引导实验尝试'))
        guidedPanel?.querySelectorAll('.lab-steps input[type="checkbox"]').forEach((item) => item.click())
        guidedPanel?.querySelectorAll('.check-list input[type="checkbox"]').forEach((item) => item.click())
        saveButton?.click()
        await waitFrame()
        const deliverableArea = q('textarea[aria-label="多表 SQL 记录 Markdown 草稿"]')
        if (deliverableArea) {
          deliverableArea.value = [
            '# 多表 SQL 记录',
            'step_id: step-2',
            'source_sql_ref: setup.sql + exercises.sql',
            'left_table: users',
            'right_table: events',
            'join_type: LEFT JOIN',
            'join_key: user_id',
            'rows_before: 6',
            'rows_after: 10',
            'unique_keys: 6',
            'amount_before: 440',
            'amount_after: 440',
            'gap_note: events 里有部分 user_id 为空',
            'can_prove: 本地教学链路能复核每一步的行数和唯一键',
            'cannot_prove: 不能证明真实生产行为或收入',
            'next_sql_task: 先连 orders，再最后对照 answers.sql',
            'W5D3',
            'W5-多表SQL',
            'multi-table-sql-log.md',
            'setup.sql',
            'exercises.sql',
            'answers.sql',
            'users',
            'events',
            'orders',
            '不能证明',
          ].join('\\n')
          deliverableArea.dispatchEvent(new Event('input', { bubbles: true }))
        }
        await waitFrame()
        qa('.deliverable-panel .check-list input[type="checkbox"]').forEach((item) => item.click())
        const deliverableButton = [...(q('.deliverable-panel')?.querySelectorAll('button') ?? [])].find((button) => text(button).includes('校验并保存完整 多表 SQL 记录'))
        deliverableButton?.click()
        await waitFrame()
        const deliverableFields = ['step_id', 'source_sql_ref', 'left_table', 'right_table', 'join_type', 'join_key', 'rows_before', 'rows_after', 'unique_keys', 'amount_before', 'amount_after', 'gap_note', 'can_prove', 'cannot_prove', 'next_sql_task']
        return {
          headline: text(q('.course-protocol')),
          cover: text(q('.cover-summary')),
          route: text(q('.w1-route-note')),
          announcement: text(q('.announcement')),
          deliverableText: text(q('.deliverable-panel')),
          deliverableFields: deliverableFields.every((field) => text(q('.deliverable-panel')).includes(field)),
        }
      })()`,
    })
    const value = result.result.value ?? {}
    assert.ok(String(value.headline ?? '').includes('多表 SQL 不是孤立结果'))
    assert.ok(String(value.cover ?? '').includes('两时段'))
    assert.ok(String(value.deliverableText ?? '').includes('多表 SQL 记录'))
    assert.ok(Boolean(value.deliverableFields), '交互页必须显示完整成果字段')
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
  dayId: 'W5D3',
  viewports: viewports.length,
  status: 'ok',
}, null, 2))
