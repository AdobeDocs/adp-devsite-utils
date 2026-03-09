const remarkLintNoBracketInTable = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const content = file.toString()
    const lines = content.split('\n')

    let inTable = false

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber]
      const trimmedLine = line.trim()

      const pipeCount = (trimmedLine.match(/\|/g) || []).length
      if (pipeCount >= 2) {
        inTable = true
      } else if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        inTable = false
        continue
      }

      if (!inTable) continue

      // Skip separator rows (e.g., |---|---|)
      if (/^\|[\s\-:|]+\|$/.test(trimmedLine)) continue

      // Strip inline code spans — content inside backticks is safe
      const lineWithoutCode = trimmedLine.replace(/`[^`]*`/g, '')

      // Match <...> that is NOT preceded by a backslash escape
      const bracketRegex = /(?<!\\)<([^>]+)(?<!\\)>/g
      let match

      while ((match = bracketRegex.exec(lineWithoutCode)) !== null) {
        const fullMatch = match[0]
        const innerContent = match[1]

        const col = line.indexOf(fullMatch)
        const position = {
          start: { line: lineNumber + 1, column: col + 1 },
          end: { line: lineNumber + 1, column: col + fullMatch.length + 1 }
        }

        const message = `Angle bracket "${fullMatch}" found in table cell. Escape with "\\<" and "\\>" to prevent MDX parsing errors (e.g., "${fullMatch}" → "\\<${innerContent}\\>").`

        if (actualSeverity === 'error') {
          file.fail(message, position, 'remark-lint:no-bracket-in-table')
        } else {
          file.message(message, position, 'remark-lint:no-bracket-in-table')
        }
      }
    }
  }
}

export default remarkLintNoBracketInTable
