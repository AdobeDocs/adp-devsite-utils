import { visit } from 'unist-util-visit'

const remarkLintNoAngleBrackets = (severity = 'warn') => {
  return (tree, file) => {
    // Visit all nodes to find actual angle bracket syntax
    visit(tree, 'text', (node) => {
      const text = node.value

      // Look for patterns like <http://...> or <https://...>
      const angleBracketUrlRegex = /<((?:https?:\/\/|www\.)[^>]+)>/g
      let match
      console.log("got in here to check for angle brackets " + file.path);

      while ((match = angleBracketUrlRegex.exec(text)) !== null) {
        const url = match[1]
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
            `Use [link text](${url}) instead of <${url}> for better accessibility`,
            position
          )
        } else {
          file.message(
            `Use [link text](${url}) instead of <${url}> for better accessibility`,
            position,
            'remark-lint:no-angle-brackets'
          )
        }
      }
    })
  }
}

export default remarkLintNoAngleBrackets
