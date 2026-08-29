export type MasteryLevel = 0 | 1 | 2 | 3

export interface ReviewRecord {
  conceptId: string
  stage: 'D1' | 'D3' | 'D7' | 'D14' | 'D30' | 'D60'
  dueAt: string
  completedAt?: string
  result?: 'forgot' | 'fuzzy' | 'mastered'
}

export interface LearningState {
  version: 1
  activeView: string
  activeLesson: number
  durationMode: 30 | 45
  completedSteps: string[]
  quizAnswers: Record<string, number>
  quizIndex: Record<string, number>
  mastery: Record<string, MasteryLevel>
  learnedAt: Record<string, string>
  reviewRecords: ReviewRecord[]
  wrongQuestionIds: string[]
  notes: Record<string, string>
  bugDraft: Record<string, string>
  practiceResults: Record<string, 'forgot' | 'fuzzy' | 'mastered'>
}

const STORAGE_KEY = 'pm-tech-lab-state-v1'

export const defaultState: LearningState = {
  version: 1,
  activeView: 'today',
  activeLesson: 1,
  durationMode: 45,
  completedSteps: [],
  quizAnswers: {},
  quizIndex: { '1': 0, '2': 0 },
  mastery: {},
  learnedAt: {},
  reviewRecords: [],
  wrongQuestionIds: [],
  notes: {},
  bugDraft: {},
  practiceResults: {},
}

export function loadState(): LearningState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(defaultState)
    const parsed = JSON.parse(raw) as Partial<LearningState>
    return {
      ...structuredClone(defaultState),
      ...parsed,
      quizIndex: { ...defaultState.quizIndex, ...(parsed.quizIndex || {}) },
      mastery: parsed.mastery || {},
      notes: parsed.notes || {},
      bugDraft: parsed.bugDraft || {},
      practiceResults: parsed.practiceResults || {},
    }
  } catch {
    return structuredClone(defaultState)
  }
}

export function saveState(state: LearningState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function downloadState(state: LearningState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `产品技术实验室-学习档案-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate.slice(0, 10)}T12:00:00+08:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function scheduleReviews(conceptId: string, learnedAt: string): ReviewRecord[] {
  return ([['D1', 1], ['D3', 3], ['D7', 7], ['D14', 14], ['D30', 30], ['D60', 60]] as const).map(([stage, days]) => ({
    conceptId,
    stage,
    dueAt: addDays(learnedAt, days),
  }))
}
