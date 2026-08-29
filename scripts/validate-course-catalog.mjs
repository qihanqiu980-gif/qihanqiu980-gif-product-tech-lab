import assert from 'node:assert/strict'
import { listDailyCourses } from '../src/course/registry.ts'
import { validateCourseCatalog } from '../src/course/validateCourseCatalog.ts'
import { w1d1 } from '../src/course/w1d1.ts'
import { validateDailyCourse } from '../src/course/validateDailyCourse.ts'

const lessons = listDailyCourses()
const catalog = validateCourseCatalog(lessons)
assert.deepEqual(catalog.issues, [])
assert.equal(catalog.firstTeachingByConcept.browser, 'W1D1')
assert.equal(Object.keys(catalog.firstTeachingByConcept).length, lessons.reduce((total, lesson) => total + lesson.concepts.length, 0))

const compactConcepts = w1d1.concepts.slice(0, 2)
const compactConceptIds = compactConcepts.map((concept) => concept.id)
const compactConceptRemediation = {
  label: '返回补学：浏览器',
  sectionId: 'concepts',
  anchor: `concept-${compactConceptIds[0]}`,
}
const compactLesson = {
  ...w1d1,
  id: 'W1D2',
  week: 1,
  day: 2,
  contentVersion: 'generic-validator-profile-test',
  objectives: w1d1.objectives.slice(0, 2),
  concepts: compactConcepts,
  coreConceptGroups: [{
    ...w1d1.coreConceptGroups[0],
    conceptIds: compactConceptIds,
  }],
  diagram: {
    ...w1d1.diagram,
    nodes: w1d1.diagram.nodes.slice(0, 3),
    branches: [
      {
        from: w1d1.diagram.nodes[0].id,
        to: w1d1.diagram.nodes[1].id,
        label: '正常教学分支',
        kind: 'normal',
      },
      {
        from: w1d1.diagram.nodes[1].id,
        to: w1d1.diagram.nodes[2].id,
        label: '教学异常分支',
        kind: 'failure',
      },
    ],
  },
  demonstration: { ...w1d1.demonstration, steps: w1d1.demonstration.steps.slice(0, 5) },
  guidedLab: { ...w1d1.guidedLab, conceptIds: compactConceptIds },
  independentLab: {
    ...w1d1.independentLab,
    conceptIds: compactConceptIds,
    changedConditions: w1d1.independentLab.changedConditions.slice(0, 1),
    remediation: compactConceptRemediation,
  },
  exercises: w1d1.exercises.map((exercise, index) => ({
    ...exercise,
    conceptIds: compactConceptIds,
    remediation: index < 3 ? compactConceptRemediation : exercise.remediation,
  })),
  deliverable: { ...w1d1.deliverable, conceptIds: compactConceptIds },
  memory: { ...w1d1.memory, conceptIds: compactConceptIds },
  nextLesson: { ...w1d1.nextLesson, id: 'W1D3' },
}
assert.deepEqual(validateDailyCourse(compactLesson).errors, [], '通用日课校验不得强迫每 Day 复制 W1D1 的 12 概念与 11 步体量')

const selfDependentConceptLesson = {
  ...compactLesson,
  concepts: compactLesson.concepts.map((concept, index) => index === 0
    ? { ...concept, prerequisiteConceptIds: [concept.id] }
    : concept),
}
assert.ok(validateDailyCourse(selfDependentConceptLesson).errors.some((error) => error.includes('不能依赖概念自身')), '概念不得把自身声明为前置')
assert.ok(validateCourseCatalog([selfDependentConceptLesson]).issues.some((item) => item.code === 'future-prerequisite' && item.message.includes('概念自身')), '目录校验也必须拒绝概念自依赖')

const sameDayFutureConceptLesson = {
  ...compactLesson,
  concepts: compactLesson.concepts.map((concept, index) => index === 0
    ? { ...concept, prerequisiteConceptIds: [compactConceptIds[1]] }
    : concept),
}
assert.ok(validateDailyCourse(sameDayFutureConceptLesson).errors.some((error) => error.includes('本日尚未教学的未来概念')), '概念不得使用本日稍后才首教的概念')
assert.ok(validateCourseCatalog([sameDayFutureConceptLesson]).issues.some((item) => item.code === 'future-prerequisite' && item.message.includes('本日未来概念')), '目录校验也必须拒绝同日未来概念')

const unknownConceptDependencyLesson = {
  ...compactLesson,
  concepts: compactLesson.concepts.map((concept, index) => index === 0
    ? { ...concept, prerequisiteConceptIds: ['never-taught-concept'] }
    : concept),
}
assert.ok(validateDailyCourse(unknownConceptDependencyLesson).errors.some((error) => error.includes('既非本日早先教学')), '未声明的未知概念不得被当作概念前置')

const uncheckedPrerequisiteLesson = {
  ...compactLesson,
  prerequisiteConceptIds: ['earlier-course-concept'],
}
assert.ok(validateDailyCourse(uncheckedPrerequisiteLesson).errors.some((error) => error.includes('前置检查绑定的概念并集')), '每个课程前置概念都必须被至少一项前置检查覆盖')

const undeclaredPrerequisiteCheckLesson = {
  ...compactLesson,
  prerequisites: compactLesson.prerequisites.map((item, index) => index === 0
    ? { ...item, conceptIds: ['undeclared-concept'] }
    : item),
}
assert.ok(validateDailyCourse(undeclaredPrerequisiteCheckLesson).errors.some((error) => error.includes('前置检查绑定的概念并集')), '前置检查不得偷偷引入课程未声明的概念')

const unassessedLesson = {
  ...compactLesson,
  guidedLab: { ...compactLesson.guidedLab, conceptIds: [compactConceptIds[0]] },
  independentLab: { ...compactLesson.independentLab, conceptIds: [compactConceptIds[0]] },
  exercises: compactLesson.exercises.map((exercise) => ({ ...exercise, conceptIds: [compactConceptIds[0]] })),
  deliverable: { ...compactLesson.deliverable, conceptIds: [compactConceptIds[0]] },
  memory: { ...compactLesson.memory, conceptIds: [compactConceptIds[0]] },
}
assert.ok(validateDailyCourse(unassessedLesson).errors.some((error) => error.includes('没有进入任何实验、练习、成果或闭卷证据')), '首次教学概念必须进入至少一种后续证据任务')

const duplicatedDeliverableExampleLesson = {
  ...compactLesson,
  deliverable: {
    ...compactLesson.deliverable,
    badExample: compactLesson.deliverable.goodExample,
  },
}
assert.ok(validateDailyCourse(duplicatedDeliverableExampleLesson).errors.some((error) => error.includes('今日成果缺少字段教学')), '成果差稿不得与合格稿相同')

const zeroContributionLesson = {
  ...compactLesson,
  learningPaths: {
    ...compactLesson.learningPaths,
    '30': {
      ...compactLesson.learningPaths['30'],
      deliverableMinimumContributionCharacters: 0,
    },
  },
}
assert.ok(validateDailyCourse(zeroContributionLesson).errors.some((error) => error.includes('成果实写门槛不能低于 40')), '学习路径必须要求学习者真正填写成果')

const regressiveStandardPathLesson = {
  ...compactLesson,
  learningPaths: {
    ...compactLesson.learningPaths,
    '45': {
      ...compactLesson.learningPaths['45'],
      deliverablePromptCount: compactLesson.learningPaths['30'].deliverablePromptCount - 1,
    },
  },
}
assert.ok(validateDailyCourse(regressiveStandardPathLesson).errors.some((error) => error.includes('45 分钟路径不能比 30 分钟路径')), '45 分钟路径不得比 30 分钟路径缩水')

const disjointStandardPathLesson = {
  ...compactLesson,
  learningPaths: {
    ...compactLesson.learningPaths,
    '45': {
      ...compactLesson.learningPaths['45'],
      guidedRecordIndices: [0, 1, 2, 3, 4, 5],
      deliverableChecklistIndices: [0, 1, 2, 3, 4, 5],
    },
  },
}
assert.ok(validateDailyCourse(disjointStandardPathLesson).errors.some((error) => error.includes('45 分钟路径必须完整包含 30 分钟路径')), '45 分钟路径必须在 30 分钟路径基础上递增，而非换掉同数量任务')

const emptyPrerequisiteStepLesson = {
  ...compactLesson,
  prerequisites: compactLesson.prerequisites.map((item, index) => index === 0
    ? { ...item, remediation: { ...item.remediation, steps: [''] } }
    : item),
}
assert.ok(validateDailyCourse(emptyPrerequisiteStepLesson).errors.some((error) => error.includes('补做步骤和成功检查')), '前置补课步骤不得使用空字符串占位')

const duplicatedConceptBodyLesson = {
  ...compactLesson,
  concepts: [
    compactLesson.concepts[0],
    {
      ...compactLesson.concepts[0],
      id: compactLesson.concepts[1].id,
      term: compactLesson.concepts[1].term,
    },
  ],
}
assert.ok(validateDailyCourse(duplicatedConceptBodyLesson).errors.some((error) => error.includes('不能复用同一套教学正文')), '不同概念不得只更换 ID 与术语后复用整套正文')

const overloadedExerciseCategoriesLesson = {
  ...compactLesson,
  exercises: compactLesson.exercises.map((exercise, index) => index === 0
    ? { ...exercise, categories: ['概念与边界', '机制推演', '证据判断', '工作场景', '综合变式'] }
    : exercise),
}
assert.ok(validateDailyCourse(overloadedExerciseCategoriesLesson).errors.some((error) => error.includes('全标签题')), '不得用单道全标签题伪造五类练习覆盖')

const firstSingleChoiceIndex = compactLesson.exercises.findIndex((exercise) => exercise.kind === 'single-choice')
assert.notEqual(firstSingleChoiceIndex, -1, 'W1D1 基准课必须包含用于校验反馈结构的单选题')
const outOfRangeChoiceLesson = {
  ...compactLesson,
  exercises: compactLesson.exercises.map((exercise, index) => index === firstSingleChoiceIndex
    ? { ...exercise, answerIndex: exercise.options?.length ?? 999 }
    : exercise),
}
assert.ok(validateDailyCourse(outOfRangeChoiceLesson).errors.some((error) => error.includes('范围内的唯一答案')), '单选题答案索引必须落在选项范围内')

const duplicatedChoiceOptionsLesson = {
  ...compactLesson,
  exercises: compactLesson.exercises.map((exercise, index) => index === firstSingleChoiceIndex
    ? {
        ...exercise,
        options: exercise.options?.map((option) => ({ ...option, label: exercise.options?.[0].label ?? '重复选项' })),
      }
    : exercise),
}
assert.ok(validateDailyCourse(duplicatedChoiceOptionsLesson).errors.some((error) => error.includes('选项内容不能重复')), '单选题不得用重复选项凑足数量')

const emptyReviewTaskLesson = {
  ...compactLesson,
  memory: {
    ...compactLesson.memory,
    reviewStages: compactLesson.memory.reviewStages.map((stage, index) => index === 0 ? { ...stage, task: '' } : stage),
  },
}
assert.ok(validateDailyCourse(emptyReviewTaskLesson).errors.some((error) => error.includes('记忆与复习必须包含')), '每个间隔复习阶段都必须包含真实任务')

const duplicatedMemoryLesson = {
  ...compactLesson,
  memory: {
    ...compactLesson.memory,
    anchors: compactLesson.memory.anchors.map(() => compactLesson.memory.anchors[0]),
    reviewStages: compactLesson.memory.reviewStages.map((stage) => ({ ...stage, task: compactLesson.memory.reviewStages[0].task })),
  },
}
assert.ok(validateDailyCourse(duplicatedMemoryLesson).errors.some((error) => error.includes('不能重复同一句占位')), '记忆锚点与间隔复习任务不得机械复制')

const duplicatedDeliverableStructureLesson = {
  ...compactLesson,
  deliverable: {
    ...compactLesson.deliverable,
    fields: compactLesson.deliverable.fields.map(() => compactLesson.deliverable.fields[0]),
    badReasons: compactLesson.deliverable.badReasons.map(() => compactLesson.deliverable.badReasons[0]),
    revisionSteps: compactLesson.deliverable.revisionSteps.map(() => compactLesson.deliverable.revisionSteps[0]),
    guidedPrompts: compactLesson.deliverable.guidedPrompts.map(() => compactLesson.deliverable.guidedPrompts[0]),
    checklist: compactLesson.deliverable.checklist.map(() => compactLesson.deliverable.checklist[0]),
  },
}
assert.ok(validateDailyCourse(duplicatedDeliverableStructureLesson).errors.some((error) => error.includes('不能重复占位')), '成果字段教学、修订和自检不得机械复制')

const terminalLesson = {
  ...compactLesson,
  id: 'W12D6',
  week: 12,
  day: 6,
  nextLesson: undefined,
}
assert.deepEqual(validateDailyCourse(terminalLesson).errors, [], 'W12D6 应允许作为核心课程终点，不得强迫伪造 W13D1')
const terminalLessonWithFakeNext = {
  ...terminalLesson,
  nextLesson: compactLesson.nextLesson,
}
assert.ok(validateDailyCourse(terminalLessonWithFakeNext).errors.some((error) => error.includes('W12D6 是核心课程终点')), 'W12D6 不得伪造下一 Day')

const wrongNextCatalog = validateCourseCatalog([{ ...w1d1, nextLesson: { ...w1d1.nextLesson, id: 'W1D3' } }])
assert.ok(wrongNextCatalog.issues.some((item) => item.code === 'wrong-next-lesson'), '目录必须阻止 Day 跳过正确的下一课')

function makeRemappedCompactLesson({ id, day, nextId, prefix }) {
  const conceptIdMap = new Map(compactConceptIds.map((conceptId) => [conceptId, `${prefix}-${conceptId}`]))
  const remapIds = (conceptIds) => conceptIds.map((conceptId) => conceptIdMap.get(conceptId) ?? conceptId)
  const remapRemediation = (remediation) => {
    if (remediation.sectionId !== 'concepts' || !remediation.anchor) return remediation
    const anchor = remediation.anchor.replace(/^#/, '')
    const conceptId = anchor.replace(/^concept-/, '')
    const remappedConceptId = conceptIdMap.get(conceptId)
    if (!remappedConceptId) return remediation
    return { ...remediation, anchor: `concept-${remappedConceptId}` }
  }
  return {
    ...compactLesson,
    id,
    day,
    contentVersion: `${prefix}-validator-fixture`,
    concepts: compactLesson.concepts.map((concept) => ({
      ...concept,
      id: conceptIdMap.get(concept.id),
      prerequisiteConceptIds: remapIds(concept.prerequisiteConceptIds),
    })),
    coreConceptGroups: compactLesson.coreConceptGroups.map((group) => ({ ...group, conceptIds: remapIds(group.conceptIds) })),
    guidedLab: { ...compactLesson.guidedLab, conceptIds: remapIds(compactLesson.guidedLab.conceptIds) },
    independentLab: {
      ...compactLesson.independentLab,
      conceptIds: remapIds(compactLesson.independentLab.conceptIds),
      remediation: remapRemediation(compactLesson.independentLab.remediation),
    },
    exercises: compactLesson.exercises.map((exercise, index) => ({
      ...exercise,
      id: `${prefix}-exercise-${index + 1}`,
      conceptIds: remapIds(exercise.conceptIds),
      remediation: remapRemediation(exercise.remediation),
    })),
    deliverable: { ...compactLesson.deliverable, conceptIds: remapIds(compactLesson.deliverable.conceptIds) },
    memory: { ...compactLesson.memory, conceptIds: remapIds(compactLesson.memory.conceptIds) },
    nextLesson: { ...compactLesson.nextLesson, id: nextId },
  }
}

const mechanicalLessonBase = makeRemappedCompactLesson({ id: 'W1D2', day: 2, nextId: 'W1D3', prefix: 'w1d2-mechanical' })
const mechanicalLesson = {
  ...mechanicalLessonBase,
  exercises: mechanicalLessonBase.exercises.map((exercise) => ({
    ...exercise,
    prompt: exercise.prompt.replaceAll('Chrome', 'Edge').replaceAll('W1D1', 'W1D2'),
  })),
}
assert.deepEqual(validateDailyCourse(mechanicalLesson).errors, [], '机械复制反例应先满足单 Day 数据完整性，再由目录级去重拦截')
const mechanicalCatalog = validateCourseCatalog([w1d1, mechanicalLesson])
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-exercise-language'), '目录必须识别只替换术语的近似练习')
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-concept-language'), '目录必须识别跨 Day 复制的概念首教正文')
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-demonstration-language'), '目录必须识别跨 Day 复制的教师示范')
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-guided-lab-language'), '目录必须识别跨 Day 复制的引导实验')
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-independent-lab-language'), '目录必须识别跨 Day 复制的独立变式')
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-deliverable-language'), '目录必须识别跨 Day 复制的成果教学')
assert.ok(mechanicalCatalog.issues.some((item) => item.code === 'duplicate-memory-language'), '目录必须识别跨 Day 复制的记忆与复习任务')

const unknownCatalogConceptId = 'never-registered-concept'
const catalogUnknownLesson = {
  ...mechanicalLesson,
  prerequisiteConceptIds: [unknownCatalogConceptId],
  prerequisites: mechanicalLesson.prerequisites.map((item, index) => index === 0
    ? { ...item, conceptIds: [unknownCatalogConceptId] }
    : item),
  concepts: mechanicalLesson.concepts.map((concept, index) => index === 0
    ? { ...concept, prerequisiteConceptIds: [unknownCatalogConceptId] }
    : concept),
}
assert.deepEqual(validateDailyCourse(catalogUnknownLesson).errors, [], '单 Day 只能验证外部概念已声明且已检查，其全局存在性由目录验证')
assert.ok(validateCourseCatalog([w1d1, catalogUnknownLesson]).issues.some((item) => item.code === 'missing-prerequisite' && item.message.includes(unknownCatalogConceptId)), '目录必须拒绝从未在已注册 Day 首教的外部概念')

const futureSourceLesson = makeRemappedCompactLesson({ id: 'W1D3', day: 3, nextId: 'W1D4', prefix: 'w1d3-future' })
const futureConceptId = futureSourceLesson.concepts[0].id
const crossDayFutureLesson = {
  ...mechanicalLesson,
  prerequisiteConceptIds: [futureConceptId],
  prerequisites: mechanicalLesson.prerequisites.map((item, index) => index === 0
    ? { ...item, conceptIds: [futureConceptId] }
    : item),
  concepts: mechanicalLesson.concepts.map((concept, index) => index === 0
    ? { ...concept, prerequisiteConceptIds: [futureConceptId] }
    : concept),
}
assert.deepEqual(validateDailyCourse(crossDayFutureLesson).errors, [], '单 Day 不猜测外部概念的时间位置，交由有全局顺序的目录校验')
const crossDayFutureCatalog = validateCourseCatalog([w1d1, crossDayFutureLesson, futureSourceLesson])
assert.ok(crossDayFutureCatalog.issues.some((item) => item.code === 'future-prerequisite' && item.message.includes(futureConceptId)), '目录必须拒绝跨 Day 使用未来才首教的概念')

console.log(`Course catalog validation passed for ${lessons.length} registered DailyCourse lesson(s).`)
