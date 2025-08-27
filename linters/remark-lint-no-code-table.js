import { visit } from 'unist-util-visit'

const remarkLintNoCodeTables = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the raw file content for line-by-line analysis
    const content = file.toString()
    const lines = content.split('\n')

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber]
      const trimmedLine = line.trim()

      // Only check lines that are table rows (contain |)
      const pipeCount = (trimmedLine.match(/\|/g) || []).length
      if (pipeCount >= 1 && (trimmedLine.includes('{') || trimmedLine.includes('}'))) {
        // Remove content within backticks before checking
        const lineWithoutInlineCode = trimmedLine.replace(/`[^`]*`/g, '')

        // Only flag if it looks like actual JSON/code, not simple placeholders
        const hasComplexJson = lineWithoutInlineCode.match(/\{[^}]*["':,\[\]]/);
        if (hasComplexJson) {
          const position = {
            start: { line: lineNumber + 1, column: 1 },
            end: { line: lineNumber + 1, column: line.length }
          }

          const message = 'JSON-like content detected in table row. Consider moving code examples outside the table.'

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
          }
        }
      }
    }
  }
}

export default remarkLintNoCodeTables
