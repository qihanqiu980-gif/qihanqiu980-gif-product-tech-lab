import type { DailyCourse, DayId } from './types'
import { EXPECTED_DAY_IDS } from './registry.ts'
import { validateDailyCourse } from './validateDailyCourse.ts'

export interface CourseCatalogIssue {
  readonly code:
    | 'duplicate-day'
    | 'unexpected-day'
    | 'invalid-day'
    | 'duplicate-concept'
    | 'missing-prerequisite'
    | 'future-prerequisite'
    | 'wrong-next-lesson'
    | 'duplicate-exercise-id'
    | 'duplicate-exercise-language'
    | 'duplicate-concept-language'
    | 'duplicate-demonstration-language'
    | 'duplicate-guided-lab-language'
    | 'duplicate-independent-lab-language'
    | 'duplicate-deliverable-language'
    | 'duplicate-memory-language'
  readonly dayId: DayId
  readonly message: string
}

export interface CourseCatalogValidation {
  readonly valid: boolean
  readonly issues: readonly CourseCatalogIssue[]
  readonly firstTeachingByConcept: Readonly<Record<string, DayId>>
}

export function validateCourseCatalog(lessons: readonly DailyCourse[]): CourseCatalogValidation {
  const issues: CourseCatalogIssue[] = []
  const expectedOrder = new Map(EXPECTED_DAY_IDS.map((dayId, index) => [dayId, index]))
  const sorted = lessons.slice().sort((left, right) => (
    (expectedOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (expectedOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  ))
  const dayIds = new Set<DayId>()
  const firstTeachingByConcept: Record<string, DayId> = {}
  const exerciseOwnerById = new Map<string, DayId>()

  for (const lesson of sorted) {
    if (dayIds.has(lesson.id)) issues.push(issue('duplicate-day', lesson.id, `课程 ID ${lesson.id} 重复注册。`))
    dayIds.add(lesson.id)
    if (!expectedOrder.has(lesson.id)) issues.push(issue('unexpected-day', lesson.id, `${lesson.id} 不在 W1D1–W12D6 计划内。`))
    const lessonIndex = expectedOrder.get(lesson.id)
    const expectedNext = lessonIndex === undefined ? undefined : EXPECTED_DAY_IDS[lessonIndex + 1]
    if (expectedNext && lesson.nextLesson?.id !== expectedNext) {
      issues.push(issue('wrong-next-lesson', lesson.id, `${lesson.id} 的下一课应为 ${expectedNext}，当前却指向 ${lesson.nextLesson?.id ?? '未声明'}。`))
    }
    if (lessonIndex === EXPECTED_DAY_IDS.length - 1 && lesson.nextLesson) {
      issues.push(issue('wrong-next-lesson', lesson.id, 'W12D6 是 12 周核心课程终点，不应指向另一个核心 Day。'))
    }

    const daily = validateDailyCourse(lesson)
    for (const error of daily.errors) issues.push(issue('invalid-day', lesson.id, error))

    for (const concept of lesson.concepts) {
      const firstDay = firstTeachingByConcept[concept.id]
      if (firstDay) issues.push(issue('duplicate-concept', lesson.id, `概念 ${concept.id} 已在 ${firstDay} 首次教学，本课不能再次冒充首次教学。`))
      else firstTeachingByConcept[concept.id] = lesson.id
    }
    for (const exercise of lesson.exercises) {
      const owner = exerciseOwnerById.get(exercise.id)
      if (owner) issues.push(issue('duplicate-exercise-id', lesson.id, `练习 ID ${exercise.id} 已由 ${owner} 使用。`))
      else exerciseOwnerById.set(exercise.id, lesson.id)
    }
  }

  for (const lesson of sorted) {
    const lessonOrder = expectedOrder.get(lesson.id) ?? Number.MAX_SAFE_INTEGER
    for (const prerequisiteId of lesson.prerequisiteConceptIds) {
      const firstDay = firstTeachingByConcept[prerequisiteId]
      if (!firstDay) {
        issues.push(issue('missing-prerequisite', lesson.id, `前置概念 ${prerequisiteId} 未在任何已注册 Day 完成首次教学。`))
        continue
      }
      if ((expectedOrder.get(firstDay) ?? Number.MAX_SAFE_INTEGER) >= lessonOrder) {
        issues.push(issue('future-prerequisite', lesson.id, `前置概念 ${prerequisiteId} 首次出现在 ${firstDay}，不早于本课。`))
      }
    }
    const conceptIndexById = new Map(lesson.concepts.map((concept, index) => [concept.id, index]))
    const declaredPrerequisiteIds = new Set(lesson.prerequisiteConceptIds)
    lesson.concepts.forEach((concept, conceptIndex) => {
      for (const prerequisiteId of concept.prerequisiteConceptIds ?? []) {
        const firstDay = firstTeachingByConcept[prerequisiteId]
        if (!firstDay) {
          issues.push(issue('missing-prerequisite', lesson.id, `概念 ${concept.id} 依赖的 ${prerequisiteId} 未在任何已注册 Day 完成首次教学。`))
          continue
        }
        if (firstDay === lesson.id) {
          const prerequisiteIndex = conceptIndexById.get(prerequisiteId)
          if (prerequisiteIndex === undefined || prerequisiteIndex >= conceptIndex) {
            const relationship = prerequisiteId === concept.id ? '概念自身' : '本日未来概念'
            issues.push(issue('future-prerequisite', lesson.id, `概念 ${concept.id} 不能依赖${relationship} ${prerequisiteId}。`))
          }
          continue
        }
        if ((expectedOrder.get(firstDay) ?? Number.MAX_SAFE_INTEGER) >= lessonOrder) {
          issues.push(issue('future-prerequisite', lesson.id, `概念 ${concept.id} 依赖的 ${prerequisiteId} 首次出现在未来课程 ${firstDay}。`))
          continue
        }
        if (!declaredPrerequisiteIds.has(prerequisiteId)) {
          issues.push(issue('missing-prerequisite', lesson.id, `概念 ${concept.id} 依赖旧课概念 ${prerequisiteId}，但 ${lesson.id} 未将它声明为课程前置。`))
        }
      }
    })
  }

  const exercisePrompts: Array<{ signature: string; dayId: DayId }> = []
  for (const lesson of sorted) {
    for (const exercise of lesson.exercises) {
      const signature = normalizeLanguage(exercise.prompt)
      if (signature.length < 16) continue
      const duplicate = exercisePrompts.find((earlier) => languageSimilarity(signature, earlier.signature) >= 0.82)
      if (duplicate) issues.push(issue('duplicate-exercise-language', lesson.id, `练习“${exercise.prompt.slice(0, 36)}…”与 ${duplicate.dayId} 高度重复，疑似只替换术语。`))
      else exercisePrompts.push({ signature, dayId: lesson.id })
    }
  }

  const conceptLanguage: LanguageSample[] = []
  const demonstrationLanguage: LanguageSample[] = []
  const guidedLabLanguage: LanguageSample[] = []
  const independentLabLanguage: LanguageSample[] = []
  const deliverableLanguage: LanguageSample[] = []
  const memoryLanguage: LanguageSample[] = []
  for (const lesson of sorted) {
    for (const concept of lesson.concepts) {
      registerInstructionalLanguage(
        conceptLanguage,
        lesson.id,
        `概念“${concept.term}”`,
        conceptTeachingLanguage(concept),
        'duplicate-concept-language',
        issues,
      )
    }
    registerInstructionalLanguage(
      demonstrationLanguage,
      lesson.id,
      '教师示范',
      demonstrationTeachingLanguage(lesson.demonstration),
      'duplicate-demonstration-language',
      issues,
    )
    registerInstructionalLanguage(
      guidedLabLanguage,
      lesson.id,
      '引导实验',
      guidedLabTeachingLanguage(lesson.guidedLab),
      'duplicate-guided-lab-language',
      issues,
    )
    registerInstructionalLanguage(
      independentLabLanguage,
      lesson.id,
      '独立变式',
      independentLabTeachingLanguage(lesson.independentLab),
      'duplicate-independent-lab-language',
      issues,
    )
    registerInstructionalLanguage(
      deliverableLanguage,
      lesson.id,
      '成果教学',
      deliverableTeachingLanguage(lesson.deliverable),
      'duplicate-deliverable-language',
      issues,
    )
    registerInstructionalLanguage(
      memoryLanguage,
      lesson.id,
      '记忆与复习',
      memoryTeachingLanguage(lesson.memory),
      'duplicate-memory-language',
      issues,
    )
  }

  return { valid: issues.length === 0, issues, firstTeachingByConcept }
}

interface LanguageSample {
  readonly signature: string
  readonly grams: ReadonlySet<string>
  readonly dayId: DayId
  readonly label: string
}

type DuplicateLanguageIssueCode = Extract<CourseCatalogIssue['code'], `duplicate-${string}-language`>

function registerInstructionalLanguage(
  samples: LanguageSample[],
  dayId: DayId,
  label: string,
  teachingText: string,
  code: DuplicateLanguageIssueCode,
  issues: CourseCatalogIssue[],
) {
  const signature = normalizeLanguage(teachingText)
  if (signature.length < 32) return
  const grams = characterNgrams(signature, 3)
  const duplicate = samples.find((earlier) => earlier.dayId !== dayId && instructionalLanguageSimilarity(signature, earlier.signature, grams, earlier.grams) >= 0.88)
  if (duplicate) {
    issues.push(issue(code, dayId, `${label}与 ${duplicate.dayId} 的${duplicate.label}高度重复，疑似只替换 Day、ID 或少量术语。`))
    return
  }
  samples.push({ signature, grams, dayId, label })
}

function conceptTeachingLanguage(concept: DailyCourse['concepts'][number]): string {
  return [
    concept.definition,
    concept.why,
    concept.problemSolved,
    concept.input,
    concept.output,
    concept.systemPosition,
    ...concept.process,
    concept.owner,
    concept.notResponsibleFor,
    concept.compareWith,
    ...concept.evidence,
    ...concept.failureModes,
    concept.pmUse,
    concept.correctExample,
    concept.incorrectExample,
  ].join('\n')
}

function demonstrationTeachingLanguage(demonstration: DailyCourse['demonstration']): string {
  return [
    demonstration.title,
    demonstration.businessProblem,
    demonstration.finalConclusion,
    demonstration.conclusionLimit,
    ...demonstration.steps.flatMap((step) => [step.title, step.action, step.reason, step.evidence, step.proves, step.limitation]),
  ].join('\n')
}

function guidedLabTeachingLanguage(lab: DailyCourse['guidedLab']): string {
  return [
    lab.title,
    lab.goal,
    lab.safety,
    lab.predictionPrompt,
    ...lab.steps.flatMap((step) => [step.title, step.action, step.observe, step.explanation, step.proves, step.cannotProve]),
    ...lab.recordPrompts,
    lab.comparePrompt,
    ...lab.passCriteria,
  ].join('\n')
}

function independentLabTeachingLanguage(lab: DailyCourse['independentLab']): string {
  return [
    lab.title,
    lab.scenario,
    ...lab.changedConditions,
    lab.task,
    lab.predictionPrompt,
    ...lab.evidenceRequirements,
    ...lab.passCriteria,
  ].join('\n')
}

function deliverableTeachingLanguage(deliverable: DailyCourse['deliverable']): string {
  return [
    deliverable.title,
    deliverable.purpose,
    deliverable.whenToUse,
    deliverable.audience,
    ...deliverable.fields.flatMap((field) => [field.name, field.meaning, field.source]),
    deliverable.badExample,
    ...deliverable.badReasons,
    ...deliverable.revisionSteps,
    deliverable.goodExample,
    ...deliverable.guidedPrompts,
    deliverable.blankTemplate,
    deliverable.standardTemplate,
    ...deliverable.checklist,
  ].join('\n')
}

function memoryTeachingLanguage(memory: DailyCourse['memory']): string {
  return [
    ...memory.anchors,
    memory.closedBookPrompt,
    memory.microOperation,
    memory.unresolvedPrompt,
    ...memory.reviewStages.map((stage) => stage.task),
  ].join('\n')
}

function languageSimilarity(left: string, right: string): number {
  if (left === right) return 1
  const leftGrams = characterNgrams(left, 3)
  const rightGrams = characterNgrams(right, 3)
  if (!leftGrams.size || !rightGrams.size) return 0
  let overlap = 0
  for (const gram of leftGrams) if (rightGrams.has(gram)) overlap += 1
  return overlap / (leftGrams.size + rightGrams.size - overlap)
}

function instructionalLanguageSimilarity(
  left: string,
  right: string,
  leftGrams: ReadonlySet<string>,
  rightGrams: ReadonlySet<string>,
): number {
  if (left === right) return 1
  if (!leftGrams.size || !rightGrams.size) return 0
  let overlap = 0
  for (const gram of leftGrams) if (rightGrams.has(gram)) overlap += 1
  const jaccard = overlap / (leftGrams.size + rightGrams.size - overlap)
  const containment = overlap / Math.min(leftGrams.size, rightGrams.size)
  return Math.max(jaccard, containment)
}

function characterNgrams(value: string, size: number): Set<string> {
  const chars = Array.from(value)
  const grams = new Set<string>()
  for (let index = 0; index <= chars.length - size; index += 1) grams.add(chars.slice(index, index + size).join(''))
  return grams
}

function normalizeLanguage(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/w\d+d\d+/g, '')
    .replace(/[\p{P}\p{S}\s\d]/gu, '')
}

function issue(code: CourseCatalogIssue['code'], dayId: DayId, message: string): CourseCatalogIssue {
  return { code, dayId, message }
}
