import assert from 'node:assert/strict'
import { w1d1 } from '../src/course/w1d1.ts'
import { listDailyCourses } from '../src/course/registry.ts'
import {
  getDayImplementation,
  inspectDailyCourseImplementation,
  listDailyCourseImplementations,
  validateDailyCourseImplementation,
} from '../src/course/implementationRegistry.ts'
import { inspectDailyCourseRendererModules } from './course-implementation-runtime.mjs'

const lessons = listDailyCourses()
const lessonsByDayId = new Map(lessons.map((lesson) => [lesson.id, lesson]))
const implementations = listDailyCourseImplementations()
assert.equal(implementations.length, lessons.length, '每个已注册 DailyCourse 都必须有正式实现注册项')

for (const lesson of lessons) {
  const inspection = inspectDailyCourseImplementation(lesson.id, lesson)
  assert.equal(inspection.resolved, true, `${lesson.id} 的 renderer、实验和证据契约必须全部解析成功`)
  assert.deepEqual(inspection.issues, [])

  const registered = getDayImplementation(lesson.id)
  assert.ok(registered, `${lesson.id} 必须有实现注册项`)
  assert.equal(typeof registered.renderer.load, 'function')
  assert.equal(typeof registered.experimentAdapter.validateLesson, 'function')
  assert.equal(typeof registered.evidenceAdapter.validateLesson, 'function')
}

const implementation = getDayImplementation('W1D1')
assert.ok(implementation, 'W1D1 必须保留冻结基准实现注册项')

const malformed = {
  ...implementation,
  renderer: { ...implementation.renderer, dayId: 'W1D2', load: undefined },
  experimentAdapter: { ...implementation.experimentAdapter, dayId: 'W1D2', validateLesson: undefined },
  evidenceAdapter: { ...implementation.evidenceAdapter, dayId: 'W1D2', schemaVersion: 0, validateLesson: undefined },
}
const malformedCodes = new Set(validateDailyCourseImplementation(malformed, w1d1).map((issue) => issue.code))
for (const code of [
  'renderer-day-mismatch',
  'renderer-loader-missing',
  'experiment-day-mismatch',
  'experiment-validator-missing',
  'evidence-day-mismatch',
  'evidence-schema-missing',
  'evidence-validator-missing',
]) {
  assert.ok(malformedCodes.has(code), `实现门禁必须拦截 ${code}`)
}

const wrongDayLesson = { ...w1d1, id: 'W1D2' }
const wrongDayCodes = new Set(validateDailyCourseImplementation(implementation, wrongDayLesson).map((issue) => issue.code))
assert.ok(wrongDayCodes.has('content-day-mismatch'), '实现门禁必须拦截课程 Day 绑定错误')
assert.ok(wrongDayCodes.has('experiment-contract-failed'), '实验契约必须拦截错误 Day')
assert.ok(wrongDayCodes.has('evidence-contract-failed'), '证据契约必须拦截错误 Day')

const rendererModuleInspections = await inspectDailyCourseRendererModules(implementations)
for (const rendererModuleInspection of rendererModuleInspections) {
  assert.equal(rendererModuleInspection.resolved, true, `${rendererModuleInspection.dayId} renderer loader 必须解析到具有 default export 的真实 Vue 模块`)
  assert.deepEqual(rendererModuleInspection.issues, [])
}

console.log(JSON.stringify(implementations.map((registered) => ({
  dayId: registered.dayId,
  renderer: registered.renderer.key,
  experimentAdapter: registered.experimentAdapter.key,
  evidenceAdapter: registered.evidenceAdapter.key,
  contractsResolved: validateDailyCourseImplementation(registered, lessonsByDayId.get(registered.dayId)).length === 0,
  rendererModuleLoaded: rendererModuleInspections.find((item) => item.dayId === registered.dayId)?.resolved === true,
})), null, 2))
