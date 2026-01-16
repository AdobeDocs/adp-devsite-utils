import { visit } from 'unist-util-visit'

const remarkLintNoUnescapedCurlyBraces = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity
    const source = file.toString()

    visit(tree, 'text', (node) => {
      const { start, end } = node.position
      
      // We must look at the "raw" source for this node to see backslashes correctly
      const nodeSource = source.slice(start.offset, end.offset)

      for (let i = 0; i < nodeSource.length; i++) {
        if (nodeSource[i] === '{') {
          
          // Count how many backslashes are immediately before this '{'
          let backslashCount = 0
          let lookupIndex = i - 1
          while (lookupIndex >= 0 && nodeSource[lookupIndex] === '\\') {
            backslashCount++
            lookupIndex--
          }

          // If backslashCount is even (0, 2, 4...), the brace is UNESCAPED.
          // If backslashCount is odd (1, 3, 5...), the brace is ESCAPED.
          const isUnescaped = (backslashCount % 2 === 0)

          if (isUnescaped) {
            const position = {
              start: {
                line: start.line,
                column: start.column + i
              },
              end: {
                line: start.line,
                column: start.column + i + 1
              }
            }

            const message = `Unescaped opening curly brace "{" found. Use "\\{" to escape it.`

            if (actualSeverity === 'error') {
              file.fail(message, position, 'remark-lint:no-unescaped-curly-braces')
            } else {
              file.message(message, position, 'remark-lint:no-unescaped-curly-braces')
            }
          }
        }
      }
    })
  }
}

export default remarkLintNoUnescapedCurlyBraces