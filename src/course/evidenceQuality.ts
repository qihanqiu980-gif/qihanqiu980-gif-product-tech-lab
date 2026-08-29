/**
 * Counts learner-authored characters without letting a prefilled Markdown
 * template satisfy a deliverable gate by itself.
 *
 * Exact template lines are ignored. For fill-in lines such as
 * `用户要完成：`, the unchanged label is also removed before counting.
 * Only letters and numbers count, so headings, punctuation and placeholder
 * underscores are not mistaken for substantive work.
 */
export function countSubstantiveContribution(draft: string, template: string): number {
  const normalizeLine = (line: string) => line.trim().replace(/^#{1,6}\s+/, '').trim()
  const setextUnderline = /^\s*(?:=+|-+)\s*$/
  const draftLines = draft.split(/\r?\n/)
  const templateLines = template
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
  const unchangedLines = new Set(templateLines)
  const fieldPrefixes = templateLines
    .filter((line) => /[:：]$/.test(line))
    .sort((left, right) => right.length - left.length)

  return draftLines.reduce((total, rawLine, index) => {
      // Headings are structure, even if a learner renames or extends them.
      if (/^\s*#{1,6}\s+/.test(rawLine)) return total
      if (setextUnderline.test(rawLine)) return total
      if (rawLine.trim() && setextUnderline.test(draftLines[index + 1] ?? '')) return total
      const originalLine = normalizeLine(rawLine)
      if (!originalLine || unchangedLines.has(originalLine)) return total
      const prefix = fieldPrefixes.find((candidate) => originalLine.startsWith(candidate))
      const authored = prefix ? originalLine.slice(prefix.length) : originalLine
      return total + Array.from(authored).filter((character) => /[\p{L}\p{N}]/u.test(character)).length
    }, 0)
}
