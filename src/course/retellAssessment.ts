import type { Day01FrameworkChapter } from './day01Framework'

export interface RetellEvidenceFields {
  retell: string
  retellSubmitted: boolean
  retellAttempts?: number
  retellFeedback?: string
  retellAnswerVisible?: boolean
}

export interface RetellAssessment {
  passed: boolean
  reason: string
  missingRubrics: string[]
}

const MIN_RETELL_CHARACTERS = 24
const instructionalTerms = new Set([
  '提到', '说明', '指出', '给出', '没有', '不能', '不要', '不把', '不声', '不得',
  '清楚', '准确', '完整', '具体', '至少', '各自', '一句', '一个', '两个', '三个',
  '复述', '解释', '比较', '写出', '列出', '引用', '包含', '进入', '同一',
])

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

function substantiveCharacters(value: string): string[] {
  return Array.from(value).filter((character) => /[\p{L}\p{N}]/u.test(character))
}

function hasLowInformationPattern(value: string): boolean {
  const characters = substantiveCharacters(value)
  if (characters.length < MIN_RETELL_CHARACTERS) return true
  const uniqueCharacters = new Set(characters)
  const frequencies = new Map<string, number>()
  for (const character of characters) frequencies.set(character, (frequencies.get(character) ?? 0) + 1)
  const highestFrequency = Math.max(...frequencies.values())
  const repeatedPhrase = /(.)\1{7,}|(.{2,4})\2{5,}/u.test(normalizedText(value))
  return uniqueCharacters.size < 10 || highestFrequency / characters.length > 0.46 || repeatedPhrase
}

function cjkBigrams(value: string): string[] {
  const source = Array.from(value.replace(/[，。；、：:,.!?！？/()（）《》“”"`'·\-\s]/g, ''))
  const grams: string[] = []
  for (let index = 0; index < source.length - 1; index += 1) {
    const gram = `${source[index]}${source[index + 1]}`
    if (!instructionalTerms.has(gram)) grams.push(gram)
  }
  return grams
}

function keywordsForRubric(rubric: string): string[] {
  const asciiTerms = rubric.toLowerCase().match(/[a-z0-9_+-]{2,}/g) ?? []
  const chunks = rubric
    .split(/[，。；、：:,.!?！？/()（）《》“”"`'·\-\s和与或及]/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 2 && !instructionalTerms.has(chunk))
  const chineseChunks = chunks.filter((chunk) => !/[a-z0-9_+-]/i.test(chunk))
  const grams = chineseChunks.flatMap(cjkBigrams)
  return [...new Set([...asciiTerms, ...chineseChunks, ...grams])].filter((term) => term.length >= 2 && !instructionalTerms.has(term))
}

function rubricMatched(answer: string, rubric: string): boolean {
  const expected = keywordsForRubric(rubric)
  if (expected.length === 0) return answer.includes(normalizedText(rubric))
  const matches = expected.filter((term) => answer.includes(term)).length
  return matches >= Math.min(2, expected.length)
}

export function buildRetellReferenceAnswer(chapter: Day01FrameworkChapter): string {
  return [
    `${chapter.lead}`,
    `本章复述要覆盖：${chapter.retellRubric.join('；')}。`,
    `练习解释可作为校准：${chapter.practice.explanation}`,
  ].join(' ')
}

export function assessChapterRetell(chapter: Day01FrameworkChapter, retell: string): RetellAssessment {
  const answer = normalizedText(retell)
  if (substantiveCharacters(answer).length < MIN_RETELL_CHARACTERS) {
    return { passed: false, reason: `至少写 ${MIN_RETELL_CHARACTERS} 个有效字，再提交复述。`, missingRubrics: [...chapter.retellRubric] }
  }
  if (hasLowInformationPattern(answer)) {
    return { passed: false, reason: '内容重复或信息量不足，不能作为本章复述证据。', missingRubrics: [...chapter.retellRubric] }
  }
  const missingRubrics = chapter.retellRubric.filter((rubric) => !rubricMatched(answer, rubric))
  if (missingRubrics.length > 0) {
    return { passed: false, reason: `还缺少：${missingRubrics.join('；')}。`, missingRubrics }
  }
  return { passed: true, reason: '复述覆盖本章量规，已进入待复核；这仍不代表掌握。', missingRubrics: [] }
}

export function createRetellEvidenceFields(): Pick<RetellEvidenceFields, 'retellAttempts' | 'retellFeedback' | 'retellAnswerVisible'> {
  return { retellAttempts: 0, retellFeedback: '', retellAnswerVisible: false }
}

export function mergeRetellEvidenceFields<T extends RetellEvidenceFields>(chapter: Day01FrameworkChapter, state: T): T {
  const attempts = Number.isFinite(Number(state.retellAttempts)) ? Math.max(0, Math.floor(Number(state.retellAttempts))) : 0
  const assessment = assessChapterRetell(chapter, state.retell || '')
  return {
    ...state,
    retellAttempts: attempts,
    retellSubmitted: Boolean(state.retellSubmitted && assessment.passed),
    retellFeedback: typeof state.retellFeedback === 'string' ? state.retellFeedback : '',
    retellAnswerVisible: Boolean(state.retellAnswerVisible && attempts >= 2 && !assessment.passed),
  }
}

export function markRetellEdited(state: RetellEvidenceFields) {
  state.retellSubmitted = false
  if ((state.retellAttempts ?? 0) < 2) state.retellAnswerVisible = false
  state.retellFeedback = ''
}

export function submitRetellForAssessment(chapter: Day01FrameworkChapter, state: RetellEvidenceFields): string {
  const assessment = assessChapterRetell(chapter, state.retell)
  if (assessment.passed) {
    state.retellSubmitted = true
    state.retellFeedback = assessment.reason
    state.retellAnswerVisible = false
    return `第 ${chapter.number} 章复述通过核验，已保存为待复核，不代表掌握。`
  }

  state.retellSubmitted = false
  state.retellAttempts = (state.retellAttempts ?? 0) + 1
  state.retellAnswerVisible = state.retellAttempts >= 2
  state.retellFeedback = state.retellAnswerVisible
    ? `${assessment.reason} 已连续 ${state.retellAttempts} 次未通过，参考答案已显示，请对照后重写。`
    : `${assessment.reason} 这是第 ${state.retellAttempts} 次未通过，先不给出参考答案。`
  return `第 ${chapter.number} 章复述未通过核验；${state.retellAnswerVisible ? '已显示参考答案。' : '请按量规补齐后再提交。'}`
}
