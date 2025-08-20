import { visit } from 'unist-util-visit'

const remarkLintNoAngleBrackets = (severity = 'warn') => {
  return (tree, file) => {
    // Visit all nodes to find actual angle bracket syntax
    visit(tree, 'text', (node) => {
      const text = node.value

      // Look for content inside angle brackets that matches link patterns
      const angleBracketRegex = /<([^>]+)>/g
      let match

      while ((match = angleBracketRegex.exec(text)) !== null) {
        const content = match[1];
        console.log('content');
        // Check if the content matches a link pattern
        const linkPattern = /^(https?:\/\/|www\.|mailto:)/
        if (linkPattern.test(content)) {
          const startColumn = node.position.start.column + match.index
          const endColumn = startColumn + match[0].length

          const position = {
            start: {
              line: node.position.start.line,
              column: startColumn
            },
            end: {
              line: node.position.end.line,
              column: endColumn
            }
          }

          // Use severity option to determine if it's a warning or error
          if (severity === 'error') {
            file.fail(
              `Use [link text](${content}) instead of <${content}> for better accessibility`,
              position
            )
          } else {
            file.message(
              `Use [link text](${content}) instead of <${content}> for better accessibility`,
              position,
              'remark-lint:no-angle-brackets'
            )
          }
        }
      }
    })
  }
}

export default remarkLintNoAngleBrackets
