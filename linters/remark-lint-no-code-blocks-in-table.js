import { visit } from 'unist-util-visit'

const remarkLintNoCodeBlocksInTables = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Visit all table nodes
    visit(tree, 'table', (tableNode) => {
      // Check each row in the table
      visit(tableNode, 'tableRow', (rowNode) => {
        // Check each cell in the row
        visit(rowNode, 'tableCell', (cellNode) => {
          // Look for code blocks within this cell
          visit(cellNode, ['code', 'inlineCode'], (codeNode) => {
            // Skip inline code (single backticks) - those are usually OK in tables
            if (codeNode.type === 'inlineCode') {
              return
            }

            // This is a code block (fenced or indented) - flag it
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

            let message = 'Code blocks should not be used within table cells. Consider moving the code block outside the table or using inline code instead.'

            // Add specific suggestions based on the code language
            if (codeNode.lang) {
              message += ` Found ${codeNode.lang} code block in table cell.`
            }

            if (actualSeverity === 'error') {
              file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
            } else {
              file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
            }
          })

          // Also check for potential code blocks in the raw content
          // This catches cases where markdown isn't properly parsed
          if (cellNode.children) {
            cellNode.children.forEach(child => {
              if (child.type === 'text' && child.value) {
                const content = child.value

                // Check for fenced code blocks (``` or ~~~)
                const fencedCodeRegex = /```[\s\S]*?```|~~~[\s\S]*?~~~/g
                let match
                while ((match = fencedCodeRegex.exec(content)) !== null) {
                  const position = {
                    start: {
                      line: child.position?.start?.line || tableNode.position?.start?.line,
                      column: (child.position?.start?.column || 1) + match.index
                    },
                    end: {
                      line: child.position?.start?.line || tableNode.position?.start?.line,
                      column: (child.position?.start?.column || 1) + match.index + match[0].length
                    }
                  }

                  const message = 'Fenced code block detected in table cell. Consider moving the code block outside the table or using inline code with single backticks.'

                  if (actualSeverity === 'error') {
                    file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
                  } else {
                    file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
                  }
                }

                // Check for indented code blocks (4+ spaces at start of line)
                const lines = content.split('\n')
                lines.forEach((line, index) => {
                  if (line.match(/^    /)) { // 4 or more spaces
                    const position = {
                      start: {
                        line: (child.position?.start?.line || 1) + index,
                        column: 1
                      },
                      end: {
                        line: (child.position?.start?.line || 1) + index,
                        column: line.length + 1
                      }
                    }

                    const message = 'Indented code block detected in table cell. Consider moving the code block outside the table or using inline code with single backticks.'

                    if (actualSeverity === 'error') {
                      file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
                    } else {
                      file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
                    }
                  }
                })

                // Check for JSON-like structures that should be code blocks
                const jsonLikeRegex = /\{\s*["'][\w\s]*["']\s*:\s*["'][\w\s]*["']/g
                while ((match = jsonLikeRegex.exec(content)) !== null) {
                  const position = {
                    start: {
                      line: child.position?.start?.line || tableNode.position?.start?.line,
                      column: (child.position?.start?.column || 1) + match.index
                    },
                    end: {
                      line: child.position?.start?.line || tableNode.position?.start?.line,
                      column: (child.position?.start?.column || 1) + match.index + match[0].length
                    }
                  }

                  const message = 'JSON-like content detected in table cell. Consider formatting as a proper code block outside the table or using inline code.'

                  if (actualSeverity === 'error') {
                    file.fail(message, position, 'remark-lint:no-code-blocks-in-tables')
                  } else {
                    file.message(message, position, 'remark-lint:no-code-blocks-in-tables')
                  }
                }
              }
            })
          }
        })
      })
    })
  }
}

export default remarkLintNoCodeBlocksInTables
