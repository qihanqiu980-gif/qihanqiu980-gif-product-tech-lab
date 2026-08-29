import type { DailyCourse, ExerciseCategory, LessonSectionId } from './types'

const instructionalSections: LessonSectionId[] = [
  'scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration',
  'guided-lab', 'independent-lab', 'exercises', 'feedback', 'deliverable', 'memory',
]
const renderedRemediationSectionIds: LessonSectionId[] = [
  'scenario', 'objectives', 'prerequisites', 'concepts', 'diagram', 'demonstration',
  'guided-lab', 'independent-lab', 'exercises', 'deliverable', 'memory',
]
const requiredExerciseCategories: ExerciseCategory[] = ['概念与边界', '机制推演', '证据判断', '工作场景', '综合变式']

export interface CourseValidationResult {
  valid: boolean
  errors: string[]
  metrics: {
    sections: number
    objectives: number
    concepts: number
    demonstrationSteps: number
    diagramNodes: number
    failureBranches: number
    exercises: number
    reviewStages: number
  }
}

export function validateDailyCourse(lesson: DailyCourse): CourseValidationResult {
  const errors: string[] = []
  const conceptFields = [
    'definition', 'why', 'problemSolved', 'input', 'output', 'systemPosition', 'owner',
    'notResponsibleFor', 'compareWith', 'pmUse', 'correctExample', 'incorrectExample',
  ] as const

  const idMatch = lesson.id.match(/^W(\d+)D(\d+)$/)
  if (!idMatch) errors.push('课程 ID 必须使用 WnDn 格式。')
  else if (Number(idMatch[1]) !== lesson.week || Number(idMatch[2]) !== lesson.day || lesson.week < 1 || lesson.week > 12 || lesson.day < 1 || lesson.day > 6) {
    errors.push('课程 ID、week 与 day 必须一致，且范围只能是 W1D1–W12D6。')
  }
  if (![lesson.contentVersion, lesson.title, lesson.subtitle, lesson.primaryGoal].every((value) => value.trim().length >= 4)) {
    errors.push('课程版本、标题、副标题和主要目标必须完整。')
  }
  if ([lesson.scenario.role, lesson.scenario.situation, lesson.scenario.question, lesson.scenario.stakes].some((value) => value.trim().length < 6)) {
    errors.push('今日工作场景必须写清角色、情境、问题和影响。')
  }
  const isTerminalLesson = lesson.id === 'W12D6'
  if (isTerminalLesson && lesson.nextLesson) errors.push('W12D6 是核心课程终点，不得伪造下一 Day；后续扩展课程应使用独立路线。')
  if (!isTerminalLesson && !lesson.nextLesson) errors.push('除 W12D6 外，每课都必须声明下一 Day。')
  if (lesson.nextLesson && ([lesson.nextLesson.title, lesson.nextLesson.bridge].some((value) => value.trim().length < 6) || lesson.nextLesson.id === lesson.id)) {
    errors.push('下一课必须指向不同 Day，并写清标题与衔接。')
  }
  if (lesson.duration.core !== 30 || lesson.duration.standard !== 45) errors.push('每日学习路径必须同时支持 30 与 45 分钟。')
  if (lesson.duration.extension < 0 || lesson.duration.full < lesson.duration.standard) {
    errors.push('完整首学估算不能短于单次标准专注时段。')
  }
  const conceptIds = new Set(lesson.concepts.map((concept) => concept.id))
  validateUniqueIds('本课概念', lesson.concepts.map((concept) => concept.id), errors)
  validateUniqueIds('学习目标', lesson.objectives.map((item) => item.id), errors)
  validateUniqueIds('前置检查', lesson.prerequisites.map((item) => item.id), errors)
  validateUniqueIds('概念主干', lesson.coreConceptGroups.map((item) => item.id), errors)
  validateUniqueIds('练习', lesson.exercises.map((item) => item.id), errors)
  const availableConceptIds = new Set([...conceptIds, ...lesson.prerequisiteConceptIds])
  const validateConceptReferences = (label: string, ids: string[]) => {
    if (!ids.length) errors.push(`${label} 必须绑定至少一个真实概念。`)
    if (new Set(ids).size !== ids.length) errors.push(`${label} 的概念 ID 不能重复。`)
    if (ids.some((conceptId) => !availableConceptIds.has(conceptId))) errors.push(`${label} 引用了本课及前置课程中不存在的概念。`)
  }
  if (lesson.coreConceptGroups.length < 1 || lesson.coreConceptGroups.some((group) => group.conceptIds.length < 1 || !group.summary.trim() || !group.boundary.trim())) {
    errors.push('必须提供至少 1 组完整概念主干，并写清摘要与证据边界。')
  }
  const groupedConceptIds = new Set(lesson.coreConceptGroups.flatMap((group) => group.conceptIds))
  if (lesson.coreConceptGroups.some((group) => group.conceptIds.some((conceptId) => !conceptIds.has(conceptId)))) {
    errors.push('概念主干不能引用本课不存在的概念。')
  }
  if (lesson.concepts.some((concept) => !groupedConceptIds.has(concept.id))) {
    errors.push('每个首次教学概念都必须进入至少一个概念主干。')
  }
  if (new Set(lesson.prerequisiteConceptIds).size !== lesson.prerequisiteConceptIds.length) {
    errors.push('前置概念 ID 不能重复。')
  }
  if (lesson.prerequisiteConceptIds.some((conceptId) => conceptIds.has(conceptId))) {
    errors.push('本课首次教学概念不能同时声明为旧课前置概念。')
  }
  const declaredPrerequisiteIds = new Set(lesson.prerequisiteConceptIds)
  const conceptIndexById = new Map(lesson.concepts.map((concept, index) => [concept.id, index]))
  lesson.concepts.forEach((concept, conceptIndex) => {
    if (!Array.isArray(concept.prerequisiteConceptIds)) {
      errors.push(`${concept.term} 必须显式声明概念级前置；无前置时使用空数组。`)
      return
    }
    validateUniqueIds(`${concept.term} 的概念级前置`, concept.prerequisiteConceptIds, errors)
    for (const prerequisiteId of concept.prerequisiteConceptIds) {
      if (prerequisiteId === concept.id) {
        errors.push(`${concept.term} 不能依赖概念自身。`)
        continue
      }
      const sameDayIndex = conceptIndexById.get(prerequisiteId)
      if (sameDayIndex !== undefined) {
        if (sameDayIndex > conceptIndex) errors.push(`${concept.term} 依赖了本日尚未教学的未来概念 ${prerequisiteId}。`)
        continue
      }
      if (!declaredPrerequisiteIds.has(prerequisiteId)) {
        errors.push(`${concept.term} 依赖的概念 ${prerequisiteId} 既非本日早先教学，也未声明为课程前置。`)
      }
    }
  })
  for (const mode of ['30', '45'] as const) {
    const path = lesson.learningPaths[mode]
    if (path.exerciseCount < 3 || path.guidedStepIndices.length < 4 || path.deliverableChecklistIndices.length < 3) {
      errors.push(`${mode} 分钟路径没有覆盖实验、至少 3 题与成果自检。`)
    }
    if (path.guidedRecordIndices.length < 3) errors.push(`${mode} 分钟路径至少需要 3 条独立实验记录。`)
    if (path.deliverableMinimumContributionCharacters < 40) errors.push(`${mode} 分钟路径的成果实写门槛不能低于 40 个有效字符。`)
    if (path.exerciseCount > lesson.exercises.length) errors.push(`${mode} 分钟路径引用了不存在的练习。`)
    if (new Set(path.guidedStepIndices).size !== path.guidedStepIndices.length) errors.push(`${mode} 分钟路径的引导实验步骤不能重复。`)
    if (new Set(path.guidedRecordIndices).size !== path.guidedRecordIndices.length) errors.push(`${mode} 分钟路径的实验记录不能重复。`)
    if (new Set(path.deliverableChecklistIndices).size !== path.deliverableChecklistIndices.length) errors.push(`${mode} 分钟路径的成果自检项不能重复。`)
    if (path.guidedStepIndices.some((index) => index < 0 || index >= lesson.guidedLab.steps.length)) errors.push(`${mode} 分钟路径引用了不存在的引导实验步骤。`)
    if (path.guidedRecordIndices.some((index) => index < 0 || index >= lesson.guidedLab.recordPrompts.length)) errors.push(`${mode} 分钟路径引用了不存在的实验记录。`)
    if (path.deliverablePromptCount < 1 || path.deliverablePromptCount > lesson.deliverable.guidedPrompts.length) errors.push(`${mode} 分钟路径的成果提示数量无效。`)
    if (path.deliverableChecklistIndices.some((index) => index < 0 || index >= lesson.deliverable.checklist.length)) errors.push(`${mode} 分钟路径引用了不存在的成果自检项。`)
    if (new Set(path.guidedStepIndices).size !== lesson.guidedLab.steps.length) errors.push(`${mode} 分钟路径不能跳过引导实验必修步骤；可跨时段完成，但不能删减首次实验。`)
  }
  const corePath = lesson.learningPaths['30']
  const standardPath = lesson.learningPaths['45']
  if (standardPath.exerciseCount < corePath.exerciseCount
    || standardPath.guidedRecordIndices.length < corePath.guidedRecordIndices.length
    || standardPath.deliverablePromptCount < corePath.deliverablePromptCount
    || standardPath.deliverableChecklistIndices.length < corePath.deliverableChecklistIndices.length
    || standardPath.deliverableMinimumContributionCharacters < corePath.deliverableMinimumContributionCharacters) {
    errors.push('45 分钟路径不能比 30 分钟路径更少题、更少记录、更少成果提示/自检或更低实写门槛。')
  }
  if (!isSuperset(standardPath.guidedRecordIndices, corePath.guidedRecordIndices)
    || !isSuperset(standardPath.deliverableChecklistIndices, corePath.deliverableChecklistIndices)) {
    errors.push('45 分钟路径必须完整包含 30 分钟路径的实验记录与成果自检，再增加学习量。')
  }
  if (lesson.objectives.length < 2 || lesson.objectives.length > 6) errors.push('每日目标必须为 2–6 个可验证目标。')
  if (lesson.objectives.some((objective) => objective.text.trim().length < 8 || objective.evidence.trim().length < 8)) {
    errors.push('每个学习目标必须写成可验证行为，并提供具体完成证据。')
  }
  if (lesson.prerequisites.length < 1) errors.push('必须提供前置知识检查。')
  const checkedPrerequisiteIds = new Set<string>()
  lesson.prerequisites.forEach((item) => {
    if (!Array.isArray(item.conceptIds)) {
      errors.push(`前置检查 ${item.id} 必须显式声明它检查的概念 ID；仅检查操作准备时使用空数组。`)
      return
    }
    validateUniqueIds(`前置检查 ${item.id} 的概念`, item.conceptIds, errors)
    item.conceptIds.forEach((conceptId) => checkedPrerequisiteIds.add(conceptId))
  })
  const uncheckedPrerequisiteIds = lesson.prerequisiteConceptIds.filter((conceptId) => !checkedPrerequisiteIds.has(conceptId))
  const undeclaredCheckedIds = [...checkedPrerequisiteIds].filter((conceptId) => !declaredPrerequisiteIds.has(conceptId))
  if (uncheckedPrerequisiteIds.length || undeclaredCheckedIds.length) {
    const details = [
      uncheckedPrerequisiteIds.length ? `未被检查：${uncheckedPrerequisiteIds.join('、')}` : '',
      undeclaredCheckedIds.length ? `未声明却被检查：${undeclaredCheckedIds.join('、')}` : '',
    ].filter(Boolean).join('；')
    errors.push(`前置检查绑定的概念并集必须与本课 prerequisiteConceptIds 完全一致（${details}）。`)
  }
  if (lesson.prerequisites.some((item) => [item.prompt, item.passDescription, item.remediationLabel, item.remediationTarget, item.remediation.purpose, item.remediation.successCheck].some((value) => value.trim().length < 4)
    || item.remediation.steps.length < 1
    || item.remediation.steps.some((step) => step.trim().length < 4))) {
    errors.push('每项前置检查必须包含判断标准、补课入口、补做步骤和成功检查。')
  }
  if (lesson.concepts.length < 1) errors.push('每日课程至少需要 1 个完整首次教学概念。')
  if (lesson.diagram.nodes.length < 3) errors.push('概念图至少需要 3 个有效节点。')
  if (lesson.diagram.branches.filter((item) => item.kind === 'normal').length < 1) errors.push('概念图至少需要 1 个正常分支。')
  if (lesson.diagram.branches.filter((item) => item.kind === 'failure').length < 1) errors.push('概念图至少需要 1 个异常分支。')
  if (!lesson.diagram.title.trim() || !lesson.diagram.caption.trim() || lesson.diagram.evidenceNotes.length < 1) errors.push('概念图必须包含标题、读图说明和可观察证据提示。')
  if (lesson.demonstration.steps.length < 5) errors.push('教师示范至少需要 5 个连续步骤，覆盖问题、操作、证据和有限结论。')
  if ([lesson.demonstration.title, lesson.demonstration.businessProblem, lesson.demonstration.finalConclusion, lesson.demonstration.conclusionLimit].some((value) => value.trim().length < 8)) {
    errors.push('教师示范必须写清业务问题、最终结论和结论限制。')
  }
  if (lesson.guidedLab.steps.length < 4) errors.push('引导实验必须包含足够的操作与观察步骤。')
  if (lesson.independentLab.changedConditions.length < 1) errors.push('独立变式必须至少提供一个实质变化条件。')
  if (!lesson.independentLab.predictionPrompt.trim()) errors.push('独立变式必须要求学习者先预测再操作。')
  if (lesson.exercises.length < 3 || lesson.exercises.length > 5) errors.push('每日练习必须为 3–5 道。')
  const coveredExerciseCategories = new Set(lesson.exercises.flatMap((exercise) => exercise.categories))
  if (requiredExerciseCategories.some((category) => !coveredExerciseCategories.has(category))) {
    errors.push('每日练习必须共同覆盖概念与边界、机制推演、证据判断、工作场景和综合变式。')
  }
  if (lesson.exercises.some((exercise) => exercise.categories.length > 2)) {
    errors.push('单道练习最多承担 2 类能力，不得用一道全标签题伪造整课覆盖。')
  }
  if (lesson.memory.reviewStages.map((item) => item.stage).join('/') !== 'D1/D3/D7/D14/D30/D60') {
    errors.push('复习计划必须完整覆盖 D1/D3/D7/D14/D30/D60。')
  }

  lesson.concepts.forEach((concept) => {
    conceptFields.forEach((field) => {
      if (concept[field].trim().length < 12) errors.push(`${concept.term} 的 ${field} 过短，不能承担完整首次教学。`)
    })
    if (concept.process.length < 2 || concept.process.some((value) => value.trim().length < 6)) errors.push(`${concept.term} 缺少完整工作过程。`)
    if (concept.evidence.length < 1 || concept.evidence.some((value) => value.trim().length < 6)) errors.push(`${concept.term} 缺少可观察证据。`)
    if (concept.failureModes.length < 1 || concept.failureModes.some((value) => value.trim().length < 6)) errors.push(`${concept.term} 缺少失败模式。`)
  })
  const conceptTeachingBodies = lesson.concepts.map((concept) => normalizeComparableText([
    ...conceptFields.map((field) => concept[field]),
    ...concept.process,
    ...concept.evidence,
    ...concept.failureModes,
  ].join('\n')))
  if (hasDuplicates(conceptTeachingBodies)) errors.push('不同首次教学概念不能复用同一套教学正文。')

  lesson.demonstration.steps.forEach((step, index) => {
    if ([step.title, step.action, step.reason, step.evidence, step.proves, step.limitation].some((value) => value.trim().length < 6)) {
      errors.push(`教师示范第 ${index + 1} 步字段不完整。`)
    }
  })

  lesson.guidedLab.steps.forEach((step, index) => {
    if ([step.title, step.action, step.observe, step.explanation, step.proves, step.cannotProve].some((value) => !value.trim())) {
      errors.push(`引导实验第 ${index + 1} 步字段不完整。`)
    }
  })
  validateConceptReferences('引导实验', lesson.guidedLab.conceptIds)
  validateConceptReferences('独立变式', lesson.independentLab.conceptIds)
  validateConceptReferences('今日成果', lesson.deliverable.conceptIds)
  validateConceptReferences('闭卷解释', lesson.memory.conceptIds)
  const assessedConceptIds = new Set([
    ...lesson.guidedLab.conceptIds,
    ...lesson.independentLab.conceptIds,
    ...lesson.exercises.flatMap((exercise) => exercise.conceptIds),
    ...lesson.deliverable.conceptIds,
    ...lesson.memory.conceptIds,
  ])
  const unassessedConcepts = lesson.concepts.filter((concept) => !assessedConceptIds.has(concept.id))
  if (unassessedConcepts.length) errors.push(`以下首次教学概念没有进入任何实验、练习、成果或闭卷证据：${unassessedConcepts.map((concept) => concept.id).join('、')}。`)

  const diagramNodeIds = new Set(lesson.diagram.nodes.map((node) => node.id))
  if (diagramNodeIds.size !== lesson.diagram.nodes.length) errors.push('概念关系图节点 ID 不能重复。')
  lesson.diagram.nodes.forEach((node) => {
    if ([node.label, node.description, node.input, node.output, node.owner].some((value) => value.trim().length < 4)) {
      errors.push(`概念关系图节点 ${node.id} 缺少作用、输入、输出或责任角色。`)
    }
  })
  lesson.diagram.branches.forEach((branch) => {
    if (!diagramNodeIds.has(branch.from) || !diagramNodeIds.has(branch.to)) errors.push(`概念关系图分支 ${branch.label} 引用了不存在的节点。`)
  })

  if ([lesson.guidedLab.title, lesson.guidedLab.goal, lesson.guidedLab.safety, lesson.guidedLab.predictionPrompt, lesson.guidedLab.comparePrompt].some((value) => value.trim().length < 8)
    || lesson.guidedLab.recordPrompts.length < 3
    || lesson.guidedLab.recordPrompts.some((value) => value.trim().length < 8)
    || lesson.guidedLab.passCriteria.length < 3
    || lesson.guidedLab.passCriteria.some((value) => value.trim().length < 8)) {
    errors.push('引导实验必须完整覆盖预测、记录、对照和通过标准。')
  }
  if ([lesson.independentLab.title, lesson.independentLab.scenario, lesson.independentLab.task, lesson.independentLab.predictionPrompt].some((value) => value.trim().length < 8)
    || lesson.independentLab.changedConditions.some((value) => value.trim().length < 8)
    || lesson.independentLab.evidenceRequirements.length < 2
    || lesson.independentLab.evidenceRequirements.some((value) => value.trim().length < 8)
    || lesson.independentLab.passCriteria.length < 3
    || lesson.independentLab.passCriteria.some((value) => value.trim().length < 8)) {
    errors.push('独立变式必须写清证据要求与可执行通过标准。')
  }
  validateRemediation('独立变式', lesson.independentLab.remediation, lesson, errors)

  const deliverableNarrative = [
    lesson.deliverable.purpose,
    lesson.deliverable.whenToUse,
    lesson.deliverable.audience,
    lesson.deliverable.badExample,
    lesson.deliverable.goodExample,
    lesson.deliverable.blankTemplate,
    lesson.deliverable.standardTemplate,
  ]
  if (lesson.deliverable.title.trim().length < 4
    || deliverableNarrative.some((value) => value.trim().length < 8)
    || normalizeComparableText(lesson.deliverable.badExample) === normalizeComparableText(lesson.deliverable.goodExample)
    || normalizeComparableText(lesson.deliverable.blankTemplate) === normalizeComparableText(lesson.deliverable.standardTemplate)
    || lesson.deliverable.fields.length < 3
    || lesson.deliverable.badReasons.length < 2
    || lesson.deliverable.badReasons.some((value) => value.trim().length < 8)
    || lesson.deliverable.revisionSteps.length < 3
    || lesson.deliverable.revisionSteps.some((value) => value.trim().length < 8)
    || lesson.deliverable.guidedPrompts.length < 3
    || lesson.deliverable.guidedPrompts.some((value) => value.trim().length < 8)
    || lesson.deliverable.checklist.length < 4
    || lesson.deliverable.checklist.some((value) => value.trim().length < 8)) {
    errors.push('今日成果缺少字段教学、差稿修订、完整范例、双模板或自检标准。')
  }
  if (lesson.deliverable.fields.some((field) => [field.name, field.meaning, field.source].some((value) => value.trim().length < 4))) {
    errors.push('今日成果的每个字段都必须写清名称、含义和信息来源。')
  }
  const deliverableFieldNames = lesson.deliverable.fields.map((field) => normalizeComparableText(field.name))
  const deliverableFieldBodies = lesson.deliverable.fields.map((field) => normalizeComparableText(`${field.name}\n${field.meaning}\n${field.source}`))
  const taughtDeliverableText = normalizeComparableText([
    lesson.deliverable.goodExample,
    lesson.deliverable.blankTemplate,
    lesson.deliverable.standardTemplate,
    ...lesson.deliverable.guidedPrompts,
  ].join('\n'))
  if (hasDuplicates(deliverableFieldNames)
    || hasDuplicates(deliverableFieldBodies)
    || lesson.deliverable.fields.some((field) => !taughtDeliverableText.includes(normalizeComparableText(field.name)))
    || [lesson.deliverable.badReasons, lesson.deliverable.revisionSteps, lesson.deliverable.guidedPrompts, lesson.deliverable.checklist].some((items) => hasDuplicates(items.map(normalizeComparableText)))) {
    errors.push('今日成果的字段、错因、修订、提示和自检必须各自具体且进入范例或模板，不能重复占位。')
  }
  if (lesson.memory.anchors.length < 3
    || lesson.memory.anchors.length > 5
    || lesson.memory.anchors.some((value) => value.trim().length < 8)
    || lesson.memory.closedBookPrompt.trim().length < 8
    || lesson.memory.microOperation.trim().length < 8
    || lesson.memory.unresolvedPrompt.trim().length < 8
    || lesson.memory.reviewStages.some((item) => item.task.trim().length < 8)) {
    errors.push('记忆与复习必须包含 3–5 条锚点、闭卷解释、微操作和未解决问题。')
  }
  if (hasDuplicates(lesson.memory.anchors.map(normalizeComparableText))
    || hasDuplicates(lesson.memory.reviewStages.map((item) => normalizeComparableText(item.task)))) {
    errors.push('记忆锚点与各阶段复习任务必须彼此不同，不能重复同一句占位。')
  }

  lesson.exercises.forEach((exercise) => {
    validateConceptReferences(`练习 ${exercise.id}`, exercise.conceptIds)
    if (!exercise.categories.length || new Set(exercise.categories).size !== exercise.categories.length) errors.push(`${exercise.id} 的练习分类缺失或重复。`)
    if (exercise.prompt.trim().length < 12 || exercise.hint.trim().length < 6 || exercise.referenceAnswer.trim().length < 12 || !exercise.reasoning.length || !exercise.rubric.length || !exercise.commonErrors.length) {
      errors.push(`${exercise.id} 的反馈与纠错字段不完整。`)
    }
    if (exercise.reasoning.some((value) => value.trim().length < 6) || exercise.rubric.some((value) => value.trim().length < 6) || exercise.commonErrors.some((item) => item.error.trim().length < 4 || item.reason.trim().length < 6)) {
      errors.push(`${exercise.id} 的推理、评分或错因说明过短。`)
    }
    validateRemediation(exercise.id, exercise.remediation, lesson, errors)
    if (exercise.kind === 'single-choice') {
      if (!exercise.options || exercise.options.length < 3 || exercise.options.length > 5 || exercise.answerIndex === undefined || exercise.answerIndex < 0 || exercise.answerIndex >= exercise.options.length) {
        errors.push(`${exercise.id} 必须包含 3–5 个选项和范围内的唯一答案。`)
      }
      if (exercise.options?.some((option) => option.label.trim().length < 2 || option.rationale.trim().length < 8 || option.couldBeTrueWhen.trim().length < 8)) errors.push(`${exercise.id} 没有逐项解释选项。`)
      if (exercise.options && hasDuplicates(exercise.options.map((option) => normalizeComparableText(option.label)))) errors.push(`${exercise.id} 的选项内容不能重复。`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    metrics: {
      sections: instructionalSections.length,
      objectives: lesson.objectives.length,
      concepts: lesson.concepts.length,
      demonstrationSteps: lesson.demonstration.steps.length,
      diagramNodes: lesson.diagram.nodes.length,
      failureBranches: lesson.diagram.branches.filter((item) => item.kind === 'failure').length,
      exercises: lesson.exercises.length,
      reviewStages: lesson.memory.reviewStages.length,
    },
  }
}

function validateUniqueIds(label: string, ids: readonly string[], errors: string[]) {
  if (ids.some((id) => !id.trim())) errors.push(`${label} ID 不能为空。`)
  if (new Set(ids).size !== ids.length) errors.push(`${label} ID 不能重复。`)
}

function hasDuplicates(values: readonly string[]) {
  return new Set(values).size !== values.length
}

function isSuperset(values: readonly number[], requiredValues: readonly number[]) {
  const valueSet = new Set(values)
  return requiredValues.every((value) => valueSet.has(value))
}

function validateRemediation(
  label: string,
  remediation: { label: string; sectionId: LessonSectionId; anchor?: string },
  lesson: DailyCourse,
  errors: string[],
) {
  if (remediation.label.trim().length < 4 || !renderedRemediationSectionIds.includes(remediation.sectionId)) {
    errors.push(`${label} 的补学位置无效或当前页面不可达。`)
    return
  }
  if (!remediation.anchor?.trim()) {
    errors.push(`${label} 必须提供稳定的补学锚点。`)
    return
  }
  if (remediation.sectionId === 'concepts') {
    const expectedAnchors = new Set(lesson.concepts.map((concept) => `concept-${concept.id}`))
    if (!expectedAnchors.has(remediation.anchor.replace(/^#/, ''))) errors.push(`${label} 的概念补学锚点不存在。`)
  }
  if (remediation.sectionId === 'demonstration' && remediation.anchor.replace(/^#/, '') !== 'demonstration-conclusion') {
    errors.push(`${label} 的示范补学锚点不存在。`)
  }
}

function normalizeComparableText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}\s]/gu, '')
}
