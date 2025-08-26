import { visit } from 'unist-util-visit'

const remarkLintNoCodeBlocksInTables = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the raw file content for line-by-line analysis
    const content = file.toString()
    const lines = content.split('\n')

    // Track if we're inside a table
    let inTable = false
    let tableStartLine = 0

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber]
      const trimmedLine = line.trim()

      // Detect table start (line with | characters)
      if (trimmedLine.includes('|') && !inTable) {
        // Check if this looks like a table row
        const pipeCount = (trimmedLine.match(/\|/g) || []).length
        if (pipeCount >= 2) {
          inTable = true
          tableStartLine = lineNumber + 1
        }
      }

      // Detect table end (empty line or non-table content)
      if (inTable && (trimmedLine === '' || (!trimmedLine.includes('|') && !trimmedLine.match(/^[-:|\s]+$/)))) {
        inTable = false
      }

      // If we're in a table, check for code blocks
      if (inTable) {
        // Check for fenced code blocks
        if (trimmedLine.includes('```') || trimmedLine.includes('~~~')) {
          const position = {
            start: { line: lineNumber + 1, column: 1 },
            end: { line: lineNumber + 1, column: line.length }
          }

          const message = 'Fenced code block detected in table. Consider moving the code block outside the table or using inline code with single backticks.'

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
          }
        }

        // Check for JSON-like structures in table cells
        const jsonPatterns = [
          /\{\s*"[^"]*"\s*:\s*"[^"]*"/,  // {"key": "value"}
          /\{\s*"[^"]*"\s*:\s*\{/,       // {"key": {
          /^\s*"[^"]*"\s*:\s*"[^"]*"/,   // "key": "value"
          /^\s*"[^"]*"\s*:\s*\d+/,       // "key": 123
          /Model:/,                       // Model: keyword
          /Example value:/                // Example value: keyword
        ]

        for (const pattern of jsonPatterns) {
          if (pattern.test(line)) {
            const match = line.match(pattern)
            if (match) {
              const position = {
                start: { line: lineNumber + 1, column: match.index + 1 },
                end: { line: lineNumber + 1, column: match.index + match[0].length }
              }

              const message = 'JSON-like content or API schema detected in table cell. Consider formatting as a proper code block outside the table.'

              if (actualSeverity === 'error') {
                file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
              } else {
                file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
              }
            }
          }
        }

        // Check for indented content that looks like code
        if (line.match(/^\s{4,}/)) {
          const position = {
            start: { line: lineNumber + 1, column: 1 },
            end: { line: lineNumber + 1, column: line.length }
          }

          const message = 'Indented content detected in table cell. This may be interpreted as a code block. Consider using inline code or moving outside the table.'

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
          }
        }

        // Check for malformed table cells with code-like content
        if (trimmedLine.includes('|') && (
          trimmedLine.includes('{') ||
          trimmedLine.includes('}') ||
          trimmedLine.includes('Example value:') ||
          trimmedLine.includes('Model:')
        )) {
          const position = {
            start: { line: lineNumber + 1, column: 1 },
            end: { line: lineNumber + 1, column: line.length }
          }

          const message = 'Code-like content detected in table cell. Consider restructuring to move code examples outside the table.'

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
          }
        }
      }
    }

    // Also check the AST for properly parsed tables
    visit(tree, 'table', (tableNode) => {
      visit(tableNode, 'tableCell', (cellNode) => {
        visit(cellNode, 'code', (codeNode) => {
          const position = {
            start: {
              line: codeNode.position?.start?.line || tableNode.position?.start?.line,
              column: codeNode.position?.start?.column || tableNode.position?.start?.column
            },
            end: {
              line: codeNode.position?.end?.line || tableNode.position?.end?.line,
              column: codeNode.position?.end?.column || tableNode.position?.end?.column
            }
          }

          let message = 'Code block found in table cell. Consider moving the code block outside the table or using inline code instead.'

          if (codeNode.lang) {
            message += ` Found ${codeNode.lang} code block.`
          }

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
          }
        })
      })
    })
  }
}

export default remarkLintNoCodeBlocksInTables
