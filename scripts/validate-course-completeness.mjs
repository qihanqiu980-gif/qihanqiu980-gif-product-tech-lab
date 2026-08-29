import { EXPECTED_DAY_IDS, listDailyCourses } from '../src/course/registry.ts'
import {
  inspectDailyCourseImplementation,
  listDailyCourseImplementations,
} from '../src/course/implementationRegistry.ts'
import { validateCourseCatalog } from '../src/course/validateCourseCatalog.ts'
import { inspectDailyCourseRendererModules } from './course-implementation-runtime.mjs'

const lessons = listDailyCourses()
const implementations = listDailyCourseImplementations()
const lessonIds = new Set(lessons.map((lesson) => lesson.id))
const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
const implementationById = new Map(implementations.map((item) => [item.dayId, item]))
const implementationInspections = implementations.map((item) => (
  inspectDailyCourseImplementation(item.dayId, lessonById.get(item.dayId))
))
const rendererModuleInspections = await inspectDailyCourseRendererModules(implementations)
const rendererModuleById = new Map(rendererModuleInspections.map((inspection) => [inspection.dayId, inspection]))
const inspectionById = new Map(implementationInspections.map((inspection) => [inspection.dayId, inspection]))
const implementationIds = new Set(implementationInspections
  .filter((inspection) => (
    inspection.resolved
    && inspection.implementation?.reviewed
    && rendererModuleById.get(inspection.dayId)?.resolved
  ))
  .map((inspection) => inspection.dayId))
const errors = []

for (const dayId of EXPECTED_DAY_IDS) {
  if (!lessonIds.has(dayId)) errors.push(`${dayId} 缺少完整 DailyCourse 内容。`)
  const implementation = implementationById.get(dayId)
  const inspection = inspectionById.get(dayId)
  if (!implementation) {
    errors.push(`${dayId} 缺少已审核渲染器、领域实验或 v2 证据适配器。`)
    continue
  }
  if (!implementation.reviewed) errors.push(`${dayId} 的实现尚未审核。`)
  for (const issue of inspection?.issues ?? []) {
    errors.push(`${dayId} [${issue.code}] ${issue.message}`)
  }
  for (const issue of rendererModuleById.get(dayId)?.issues ?? []) {
    errors.push(`${dayId} [renderer-module-resolution] ${issue}`)
  }
}

for (const implementation of implementations) {
  if (EXPECTED_DAY_IDS.includes(implementation.dayId)) continue
  errors.push(`${implementation.dayId} 是计划外实现。`)
  for (const issue of inspectionById.get(implementation.dayId)?.issues ?? []) {
    errors.push(`${implementation.dayId} [${issue.code}] ${issue.message}`)
  }
  for (const issue of rendererModuleById.get(implementation.dayId)?.issues ?? []) {
    errors.push(`${implementation.dayId} [renderer-module-resolution] ${issue}`)
  }
}

const catalog = validateCourseCatalog(lessons)
errors.push(...catalog.issues.map((item) => `${item.dayId} [${item.code}] ${item.message}`))

const report = {
  expected: EXPECTED_DAY_IDS.length,
  contentRegistered: lessonIds.size,
  implementationsReviewed: implementationIds.size,
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
  complete: errors.length === 0,
  errors,
}

console.log(JSON.stringify(report, null, 2))
if (errors.length) process.exitCode = 1
