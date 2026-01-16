import { visit } from 'unist-util-visit'

const remarkLintNoCodeTables = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the raw file content for line-by-line analysis
    const content = file.toString()
    const lines = content.split('\n')

    let inTable = false

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber]
      const trimmedLine = line.trim()

      // Check if this line is part of a table (contains |)
      const pipeCount = (trimmedLine.match(/\|/g) || []).length
      
      if (pipeCount >= 1) {
        // We're in a table
        inTable = true
        
        // Check if this table row contains triple backticks
        if (trimmedLine.includes('```')) {
          const position = {
            start: { line: lineNumber + 1, column: 1 },
            end: { line: lineNumber + 1, column: line.length }
          }

          const message = 'Multi-line code blocks (```) are not allowed in tables. Use inline code with single backticks (`) instead, or move the code block outside the table.'

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
          }
        }
      } else if (trimmedLine === '') {
        // Empty line ends the table
        inTable = false
      }
    }
  }
}

export default remarkLintNoCodeTables
