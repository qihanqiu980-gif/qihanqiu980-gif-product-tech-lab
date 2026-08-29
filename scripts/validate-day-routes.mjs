import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { EXPECTED_DAY_IDS, getDailyCourse, listDailyCourses } from '../src/course/registry.ts'
import { getDailyCourseRouteState } from '../src/course/dayRouteState.ts'
import { parseHashRoute, routeToHash } from '../src/hashRouter.ts'

assert.equal(EXPECTED_DAY_IDS.length, 72, '课程路线必须覆盖 W1D1–W12D6 共 72 个 Day')
assert.equal(new Set(EXPECTED_DAY_IDS).size, EXPECTED_DAY_IDS.length, '72 Day 路由不得重复')

let available = 0
let implementationPending = 0
let contentMissing = 0

for (const dayId of EXPECTED_DAY_IDS) {
  const hash = routeToHash({ view: 'day', dayId })
  assert.equal(hash, `#/lesson/${dayId}`, `${dayId} 必须生成稳定深链`)
  assert.deepEqual(parseHashRoute(hash), { view: 'day', dayId }, `${dayId} 深链必须可逆解析`)

  const state = getDailyCourseRouteState(dayId)
  assert.equal(state.dayId, dayId)
  assert.equal(state.week, Number(/^W(\d+)D/.exec(dayId)?.[1]))
  assert.equal(state.day, Number(/D(\d+)$/.exec(dayId)?.[1]))
  assert.ok(state.intendedTitle.trim().length >= 4, `${dayId} 缺课页仍需有可理解标题`)
  assert.equal(state.access.mode, 'independent-preview', `${dayId} 必须使用独立预览访问策略`)
  assert.equal(state.access.requiresPriorDayCompletion, false, `${dayId} 不得要求先完成前一天`)

  if (state.status === 'available') {
    available += 1
    assert.ok(state.lesson, `${dayId} 不得在缺少课程内容时开放`)
    assert.equal(state.implementationInspection.resolved, true, `${dayId} 开放前必须通过实现契约`)
    assert.equal(state.implementationInspection.implementation?.dayId, dayId, `${dayId} 不得复用其他 Day 的实现`)
    assert.equal(state.implementationInspection.implementation?.renderer.dayId, dayId, `${dayId} 不得复用其他 Day 的渲染器`)
    assert.equal(state.implementationInspection.implementation?.experimentAdapter.dayId, dayId, `${dayId} 不得复用其他 Day 的领域实验`)
    assert.equal(state.implementationInspection.implementation?.evidenceAdapter.dayId, dayId, `${dayId} 不得复用其他 Day 的证据适配器`)
  } else if (state.status === 'implementation-pending') {
    implementationPending += 1
    assert.ok(state.lesson, `${dayId} 只有登记完整内容后才能进入实现待审状态`)
    assert.equal(state.implementationInspection.resolved, false, `${dayId} 实现未通过时不得开放`)
  } else {
    contentMissing += 1
    assert.equal(state.lesson, undefined, `${dayId} 缺内容时必须显示诚实缺课页`)
    assert.equal(getDailyCourse(dayId), undefined, `${dayId} 缺课状态必须与权威注册表一致`)
  }
}

assert.equal(available + implementationPending + contentMissing, EXPECTED_DAY_IDS.length)
assert.equal(available + implementationPending, listDailyCourses().length, '路由内容状态必须与权威课程注册表一致')
assert.equal(getDailyCourseRouteState('W1D1').status, 'available', 'W1D1 内容质量基准必须保持可学习')
assert.equal(getDailyCourseRouteState('W1D2').status, 'available', 'W1D2 必须保持可学习')
assert.equal(getDailyCourseRouteState('W1D2').access.requiresPriorDayCompletion, false, 'W1D1 未完成时仍必须能提前观看 W1D2')

const routeStatePath = fileURLToPath(new URL('../src/course/dayRouteState.ts', import.meta.url))
const routeStateSource = readFileSync(routeStatePath, 'utf8')
assert.doesNotMatch(routeStateSource, /evidenceStore|getDayProgress|completedAt|mastery/i, '路由可用性不得读取学习进度、完成时间或掌握状态')

for (const invalidHash of ['#/lesson/W0D1', '#/lesson/W1D0', '#/lesson/W13D1', '#/lesson/W1D7', '#/lesson/W1D1/extra']) {
  assert.deepEqual(parseHashRoute(invalidHash), { view: 'today' }, `无效地址 ${invalidHash} 必须安全返回今日页`)
}

console.log(JSON.stringify({ expected: 72, available, implementationPending, contentMissing }, null, 2))
