import { visit } from 'unist-util-visit'

const remarkLintNoBrInTables = (severity = 'warning') => {
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

      // Detect table end (empty line or new heading)
      if (inTable && (trimmedLine === '' || trimmedLine.startsWith('#'))) {
        inTable = false
      }

      // If we're in a table, check for <br> tags
      if (inTable && trimmedLine.includes('|')) {
        // Check for various forms of <br> tags
        const brTagRegex = /<br\s*\/?>/gi
        let match

        while ((match = brTagRegex.exec(trimmedLine)) !== null) {
          const position = {
            start: { line: lineNumber + 1, column: match.index + 1 },
            end: { line: lineNumber + 1, column: match.index + match[0].length + 1 }
          }

          const message = `<br> tag found in table row. Use proper table structure with separate rows instead of line breaks within cells.`

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-br-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-br-in-tables')
          }
        }
      }
    }

    // Also check the AST for properly parsed tables
    visit(tree, 'table', (tableNode) => {
      visit(tableNode, 'tableCell', (cellNode) => {
        visit(cellNode, 'html', (htmlNode) => {
          const content = htmlNode.value
          
          // Check for <br> tags in HTML nodes within table cells
          const brTagRegex = /<br\s*\/?>/gi
          let match

          while ((match = brTagRegex.exec(content)) !== null) {
            const position = {
              start: {
                line: htmlNode.position?.start?.line || tableNode.position?.start?.line,
                column: htmlNode.position?.start?.column || tableNode.position?.start?.column
              },
              end: {
                line: htmlNode.position?.end?.line || tableNode.position?.end?.line,
                column: htmlNode.position?.end?.column || tableNode.position?.end?.column
              }
            }

            const message = `<br> tag found in table cell. Use proper table structure with separate rows instead of line breaks within cells.`

            if (actualSeverity === 'error') {
              file.fail(message, position, 'remark-lint:no-br-in-tables')
            } else {
              file.message(message, position, 'remark-lint:no-br-in-tables')
            }
          }
        })
      })
    })
  }
}

export default remarkLintNoBrInTables
