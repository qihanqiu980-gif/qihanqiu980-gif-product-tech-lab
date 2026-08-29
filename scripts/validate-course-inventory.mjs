import { EXPECTED_DAY_IDS, listDailyCourses } from '../src/course/registry.ts'
import {
  inspectDailyCourseImplementation,
  listDailyCourseImplementations,
} from '../src/course/implementationRegistry.ts'
import { inspectDailyCourseRendererModules } from './course-implementation-runtime.mjs'

const expected = [...EXPECTED_DAY_IDS]
const registeredLessons = listDailyCourses()
const registeredIds = registeredLessons.map((lesson) => lesson.id)
const lessonById = new Map(registeredLessons.map((lesson) => [lesson.id, lesson]))
const implementations = listDailyCourseImplementations()
const implementationInspections = implementations.map((item) => (
  inspectDailyCourseImplementation(item.dayId, lessonById.get(item.dayId))
))
const rendererModuleInspections = await inspectDailyCourseRendererModules(implementations)
const rendererModuleById = new Map(rendererModuleInspections.map((inspection) => [inspection.dayId, inspection]))
const implementedIds = implementationInspections
  .filter((inspection) => (
    inspection.resolved
    && inspection.implementation?.reviewed
    && rendererModuleById.get(inspection.dayId)?.resolved
  ))
  .map((inspection) => inspection.dayId)
const errors = []

for (const lesson of registeredLessons) {
  const expectedId = `W${lesson.week}D${lesson.day}`
  if (lesson.id !== expectedId) errors.push(`${lesson.id} 的 week/day 与课程 ID 不一致。`)
}

const duplicateIds = registeredIds.filter((id, index) => registeredIds.indexOf(id) !== index)
if (duplicateIds.length) errors.push(`发现重复课程 ID：${[...new Set(duplicateIds)].join('、')}`)
const unexpected = registeredIds.filter((id) => !expected.includes(id))
if (unexpected.length) errors.push(`发现计划外课程 ID：${unexpected.join('、')}`)
const implementationIds = implementations.map((item) => item.dayId)
const unexpectedImplementations = implementationIds.filter((id) => !expected.includes(id))
if (unexpectedImplementations.length) errors.push(`发现计划外实现 ID：${unexpectedImplementations.join('、')}`)

for (const inspection of implementationInspections) {
  for (const issue of inspection.issues) {
    errors.push(`${inspection.dayId} [${issue.code}] ${issue.message}`)
  }
}
for (const inspection of rendererModuleInspections) {
  for (const issue of inspection.issues) {
    errors.push(`${inspection.dayId} [renderer-module-resolution] ${issue}`)
  }
}

const contentRegistered = [...new Set(registeredIds)].filter((id) => expected.includes(id))
const implemented = [...new Set(implementedIds)].filter((id) => expected.includes(id))
const available = contentRegistered.filter((id) => implemented.includes(id))
const missing = expected.filter((id) => !available.includes(id))
const report = {
  generatedAt: new Date().toISOString(),
  expected: expected.length,
  contentRegistered: contentRegistered.length,
  implemented: implemented.length,
  available: available.length,
  complete: missing.length === 0 && errors.length === 0,
  registered: contentRegistered,
  availableIds: available,
  missing,
  missingContent: expected.filter((id) => !contentRegistered.includes(id)),
  missingImplementation: expected.filter((id) => !implemented.includes(id)),
  implementationDiagnostics: implementationInspections.map((inspection) => ({
    dayId: inspection.dayId,
    reviewed: inspection.implementation?.reviewed ?? false,
    renderer: inspection.implementation?.renderer.key,
    experimentAdapter: inspection.implementation?.experimentAdapter.key,
    evidenceAdapter: inspection.implementation?.evidenceAdapter.key,
    contractResolved: inspection.resolved,
    rendererModuleResolved: rendererModuleById.get(inspection.dayId)?.resolved ?? false,
    resolved: inspection.resolved && (rendererModuleById.get(inspection.dayId)?.resolved ?? false),
    issues: inspection.issues,
  })),
  errors,
}

console.log(JSON.stringify(report, null, 2))
if (errors.length) process.exitCode = 1
