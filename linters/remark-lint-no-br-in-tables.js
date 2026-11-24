import { visit } from 'unist-util-visit'

const remarkLintNoBrInTables = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity
    const lines = file.toString().split(/\r\n|\n|\r/)

    visit(tree, 'table', (tableNode) => {
      const codePositions = []
      visit(tableNode, 'inlineCode', (node) => codePositions.push(node.position))

      for (let lineNumber = tableNode.position.start.line; lineNumber <= tableNode.position.end.line; lineNumber++) {
        const line = lines[lineNumber - 1]
        const brTagRegex = /<br\s*\/?\\?>/gi
        let match

        while ((match = brTagRegex.exec(line)) !== null) {
          if (codePositions.some(position =>
            position.start.line === lineNumber &&
            position.start.column <= match.index + 1 &&
            position.end.column > match.index + 1
          )) continue

          let backslashes = 0
          for (let index = match.index - 1; index >= 0 && line[index] === '\\'; index--) {
            backslashes++
          }
          if (backslashes % 2 === 1) continue

          const position = {
            start: { line: lineNumber, column: match.index + 1 },
            end: { line: lineNumber, column: match.index + match[0].length + 1 }
          }
          const message = '<br> tag found in table row. Use \\<br/> within the table to be escaped.'

          if (actualSeverity === 'error') {
            file.fail(message, position, 'remark-lint:no-br-in-tables')
          } else {
            file.message(message, position, 'remark-lint:no-br-in-tables')
          }
        }
      }
    })
  }
}

export default remarkLintNoBrInTables
