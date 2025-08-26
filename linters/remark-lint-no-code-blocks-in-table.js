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

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber]
      const trimmedLine = line.trim()

      // Detect table start (line with | characters)
      if (trimmedLine.includes('|') && !inTable) {
        // Check if this looks like a table row
        const pipeCount = (trimmedLine.match(/\|/g) || []).length
        if (pipeCount >= 2) {
          inTable = true
        }
      }

      // Detect table end (empty line or non-table content)
      if (inTable && (trimmedLine === '' || (!trimmedLine.includes('|') && !trimmedLine.match(/^[-:|\s]+$/)))) {
        inTable = false
      }

      // If we're in a table, check for JSON-like content starting with {
      if (inTable && trimmedLine.includes('|') && trimmedLine.includes('{')) {
        // Remove content within backticks before checking for {
        const lineWithoutInlineCode = trimmedLine.replace(/`[^`]*`/g, '')
        
        // Only flag if { still exists after removing inline code
        if (lineWithoutInlineCode.includes('{')) {
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

    // Also check the AST for properly parsed code blocks in tables
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

          const message = 'Code block found in table cell. Consider moving the code block outside the table.'

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
