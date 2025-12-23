import { visit } from 'unist-util-visit'

const remarkLintNoUnescapedCurlyBraces = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const source = file.toString()

    // Visit only 'text' nodes - this automatically excludes:
    // - inline code (single backtick fenced preformatted code)
    // - code (triple backtick fenced preformatted code)
    visit(tree, 'text', (node) => {
      const content = node.value

      // Find all opening curly braces in the text
      let index = 0
      while ((index = content.indexOf('{', index)) !== -1) {
        // Calculate the position in the original source
        const sourceOffset = node.position.start.offset + index

        // Check if the curly brace is escaped
        // When remark parses \{, the position points to the \, not the {
        const isEscaped = source[sourceOffset] === '\\'

        if (!isEscaped) {
          // Calculate line and column for the error position
          const position = {
            start: {
              line: node.position.start.line,
              column: node.position.start.column + index
            },
            end: {
              line: node.position.start.line,
              column: node.position.start.column + index + 1
            }
          }

          const message = `Unescaped opening curly brace "{" found. Use "\\{" to escape it.`

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-unescaped-curly-braces')
          } else {
            file.message(message, position, 'remark-lint:no-unescaped-curly-braces')
          }
        }

        index++
      }
    })
  }
}

export default remarkLintNoUnescapedCurlyBraces