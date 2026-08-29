import type { ConceptLesson, DailyCourse, DayId } from './types'
import { w1d1 } from './w1d1.ts'
import { w1d2 } from './w1d2.ts'
import { w1d3 } from './w1d3.ts'
import { w1d4 } from './w1d4.ts'
import { w1d5 } from './w1d5.ts'
import { w3d1 } from './w3d1.ts'
import { w3d2 } from './w3d2.ts'
import { w3d3 } from './w3d3.ts'
import { w3d4 } from './w3d4.ts'
import { w3d5 } from './w3d5.ts'
import { w3d6 } from './w3d6.ts'
import { w4d1 } from './w4d1.ts'
import { w4d2 } from './w4d2.ts'
import { w4d3 } from './w4d3.ts'
import { w4d4 } from './w4d4.ts'
import { w5d2 } from './w5d2.ts'
import { w5d3 } from './w5d3.ts'
import { w8d1 } from './w8d1.ts'
import { w8d2 } from './w8d2.ts'
import { w8d6 } from './w8d6.ts'
import { w9d3 } from './w9d3.ts'
import { w11d1 } from './w11d1.ts'
import { w11d2 } from './w11d2.ts'
import { w11d3 } from './w11d3.ts'
import { w11d4 } from './w11d4.ts'
import { w11d5 } from './w11d5.ts'
import { w11d6 } from './w11d6.ts'
import { w12d1 } from './w12d1.ts'
import { w12d2 } from './w12d2.ts'
import { w12d3 } from './w12d3.ts'
import { w12d4 } from './w12d4.ts'
import { w12d5 } from './w12d5.ts'
import { w12d6 } from './w12d6.ts'

/**
 * The authoritative registry contains only lessons that have been written and
 * reviewed as full DailyCourse material. Outline rows from data.ts are
 * intentionally excluded: a title and generated exercises must never make a
 * missing Day appear complete.
 */
const dailyCourseEntries = [w1d1, w1d2, w1d3, w1d4, w1d5, w3d1, w3d2, w3d3, w3d4, w3d5, w3d6, w4d1, w4d2, w4d3, w4d4, w5d2, w5d3, w8d1, w8d2, w8d6, w9d3, w11d1, w11d2, w11d3, w11d4, w11d5, w11d6, w12d1, w12d2, w12d3, w12d4, w12d5, w12d6] as const satisfies readonly DailyCourse[]

export const EXPECTED_DAY_IDS: readonly DayId[] = Object.freeze(
  Array.from({ length: 12 }, (_, weekIndex) =>
    Array.from({ length: 6 }, (_, dayIndex) => `W${weekIndex + 1}D${dayIndex + 1}` as DayId),
  ).flat(),
)

const dailyCourseMap = new Map<DayId, DailyCourse>()
for (const lesson of dailyCourseEntries) {
  if (dailyCourseMap.has(lesson.id)) throw new Error(`Duplicate DailyCourse id: ${lesson.id}`)
  dailyCourseMap.set(lesson.id, lesson)
}

export interface RegisteredConcept {
  readonly id: string
  readonly dayId: DayId
  readonly dayTitle: string
  readonly prerequisiteConceptIds: readonly string[]
  readonly concept: ConceptLesson
  readonly guidedLabTitle: string
  readonly independentLabTitle: string
}

const registeredConcepts: RegisteredConcept[] = []
const conceptOwnerById = new Map<string, DayId>()
for (const lesson of dailyCourseEntries) {
  for (const concept of lesson.concepts) {
    const owner = conceptOwnerById.get(concept.id)
    if (owner) throw new Error(`Duplicate concept id ${concept.id}: ${owner} and ${lesson.id}`)
    conceptOwnerById.set(concept.id, lesson.id)
    registeredConcepts.push({
      id: concept.id,
      dayId: lesson.id,
      dayTitle: lesson.title,
      prerequisiteConceptIds: lesson.prerequisiteConceptIds,
      concept,
      guidedLabTitle: lesson.guidedLab.title,
      independentLabTitle: lesson.independentLab.title,
    })
  }
}

export function listDailyCourses(): readonly DailyCourse[] {
  return [...dailyCourseMap.values()].sort((left, right) => (
    left.week - right.week || left.day - right.day
  ))
}

export function listRegisteredConcepts(): readonly RegisteredConcept[] {
  return registeredConcepts.slice()
}

export function getDailyCourse(dayId: DayId): DailyCourse | undefined {
  return dailyCourseMap.get(dayId)
}

export function hasDailyCourse(dayId: DayId): boolean {
  return dailyCourseMap.has(dayId)
}

export function listMissingDailyCourseIds(): readonly DayId[] {
  return EXPECTED_DAY_IDS.filter((dayId) => !dailyCourseMap.has(dayId))
}

export interface DailyCourseInventory {
  readonly expected: number
  readonly available: number
  readonly missing: readonly DayId[]
  readonly complete: boolean
}

export function getDailyCourseInventory(): DailyCourseInventory {
  const missing = listMissingDailyCourseIds()
  return {
    expected: EXPECTED_DAY_IDS.length,
    available: dailyCourseMap.size,
    missing,
    complete: missing.length === 0,
  }
}
