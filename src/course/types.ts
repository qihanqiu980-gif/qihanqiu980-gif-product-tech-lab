export type DayId = `W${number}D${number}`

export type LessonSectionId =
  | 'scenario'
  | 'objectives'
  | 'prerequisites'
  | 'concepts'
  | 'diagram'
  | 'demonstration'
  | 'guided-lab'
  | 'independent-lab'
  | 'exercises'
  | 'feedback'
  | 'deliverable'
  | 'memory'
  | 'completion'

export interface LearningObjective {
  id: string
  text: string
  evidence: string
}

export interface PrerequisiteCheck {
  id: string
  /** Earlier-Day concepts whose readiness this check actually verifies. */
  conceptIds: string[]
  prompt: string
  passDescription: string
  remediationLabel: string
  remediationTarget: string
  remediation: {
    purpose: string
    steps: string[]
    successCheck: string
  }
}

export interface ConceptLesson {
  id: string
  /** Concepts that must already be taught before this concept is introduced. */
  prerequisiteConceptIds: string[]
  term: string
  english?: string
  definition: string
  why: string
  problemSolved: string
  input: string
  output: string
  systemPosition: string
  process: string[]
  owner: string
  notResponsibleFor: string
  compareWith: string
  evidence: string[]
  failureModes: string[]
  pmUse: string
  correctExample: string
  incorrectExample: string
}

export interface DiagramNode {
  id: string
  label: string
  description: string
  input: string
  output: string
  owner: string
  evidence?: string
}

export interface DiagramBranch {
  from: string
  to: string
  label: string
  kind: 'normal' | 'failure'
}

export interface DemonstrationStep {
  title: string
  action: string
  reason: string
  evidence: string
  proves: string
  limitation: string
}

export interface GuidedLabStep {
  title: string
  action: string
  observe: string
  explanation: string
  proves: string
  cannotProve: string
}

export interface GuidedLab {
  title: string
  goal: string
  safety: string
  conceptIds: string[]
  predictionPrompt: string
  steps: GuidedLabStep[]
  recordPrompts: string[]
  comparePrompt: string
  passCriteria: string[]
}

export interface IndependentLab {
  title: string
  scenario: string
  conceptIds: string[]
  changedConditions: string[]
  task: string
  predictionPrompt: string
  evidenceRequirements: string[]
  passCriteria: string[]
  remediation: {
    label: string
    sectionId: LessonSectionId
    anchor?: string
  }
}

export interface ExerciseOption {
  label: string
  rationale: string
  couldBeTrueWhen: string
}

export interface Exercise {
  id: string
  kind: 'single-choice' | 'ordering' | 'open'
  categories: ExerciseCategory[]
  conceptIds: string[]
  prompt: string
  hint: string
  options?: ExerciseOption[]
  answerIndex?: number
  referenceAnswer: string
  reasoning: string[]
  rubric: string[]
  commonErrors: Array<{ error: string; reason: string }>
  remediation: { label: string; sectionId: LessonSectionId; anchor?: string }
}

export interface DeliverableLesson {
  title: string
  conceptIds: string[]
  purpose: string
  whenToUse: string
  audience: string
  fields: Array<{ name: string; meaning: string; source: string }>
  badExample: string
  badReasons: string[]
  revisionSteps: string[]
  goodExample: string
  guidedPrompts: string[]
  blankTemplate: string
  standardTemplate: string
  checklist: string[]
}

export interface CoreConceptGroup {
  id: string
  title: string
  conceptIds: string[]
  summary: string
  boundary: string
}

export interface DailyLearningPath {
  guidedStepIndices: number[]
  guidedRecordIndices: number[]
  exerciseCount: 3 | 4 | 5
  deliverablePromptCount: number
  deliverableChecklistIndices: number[]
  /** Learner-authored characters after unchanged template scaffolding is removed. */
  deliverableMinimumContributionCharacters: number
}

export interface MemoryPlan {
  conceptIds: string[]
  anchors: string[]
  closedBookPrompt: string
  microOperation: string
  unresolvedPrompt: string
  reviewStages: Array<{ stage: 'D1' | 'D3' | 'D7' | 'D14' | 'D30' | 'D60'; task: string }>
}

export type ExerciseCategory = '概念与边界' | '机制推演' | '证据判断' | '工作场景' | '综合变式'

export interface DailyCourse {
  id: DayId
  contentVersion: string
  week: number
  day: number
  title: string
  subtitle: string
  duration: {
    /** A focused study-session budget; the complete lesson may span sessions. */
    core: 30
    /** A longer study-session budget; it never removes required first teaching. */
    standard: 45
    /** Additional time for reading every full explanation and worked example. */
    extension: number
    /** Estimated time for the complete required first-learning path. */
    full: number
  }
  coreConceptGroups: CoreConceptGroup[]
  /** Concepts from earlier Days that this lesson assumes are already taught. */
  prerequisiteConceptIds: string[]
  learningPaths: Record<'30' | '45', DailyLearningPath>
  primaryGoal: string
  scenario: { role: string; situation: string; question: string; stakes: string }
  objectives: LearningObjective[]
  prerequisites: PrerequisiteCheck[]
  concepts: ConceptLesson[]
  diagram: { title: string; caption: string; nodes: DiagramNode[]; branches: DiagramBranch[]; evidenceNotes: string[] }
  demonstration: { title: string; businessProblem: string; finalConclusion: string; conclusionLimit: string; steps: DemonstrationStep[] }
  guidedLab: GuidedLab
  independentLab: IndependentLab
  exercises: Exercise[]
  deliverable: DeliverableLesson
  memory: MemoryPlan
  /** Omitted only by the terminal lesson W12D6. */
  nextLesson?: { id: DayId; title: string; bridge: string }
}
