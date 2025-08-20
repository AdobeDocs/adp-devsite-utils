import { visit } from 'unist-util-visit'

const remarkLintNoAngleBrackets = (severity = 'warning') => {
  return (tree, file) => {
    console.log("check angel bracket");
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Visit all nodes to find angle bracket links
    visit(tree, (node) => {
      // Only detect raw text nodes containing angle bracket URLs
              console.log(`check angel bracket node.type ${node.type}`);
      if (node.type === 'text') {
        const text = node.value

        // Look for patterns like <www.example.com> or <http://example.com>
        const angleBracketUrlRegex = /<((?:https?:\/\/)?(?:www\.)?[^\s<>]+)>/g
        let match

        while ((match = angleBracketUrlRegex.exec(text)) !== null) {
          const url = match[1]
          const fullMatch = match[0]

          // Calculate position for the specific match within the text node
          const startColumn = node.position.start.column + match.index
          const endColumn = startColumn + fullMatch.length

          const position = {
            start: {
              line: node.position.start.line,
              column: startColumn
            },
            end: {
              line: node.position.start.line,
              column: endColumn
            }
          }

          if (actualSeverity === 'error') {
            file.fail(
              `Use [link text](${url}) instead of <${url}> for better accessibility`,
              position,
              'remark-lint:no-angle-brackets'
            )
          } else {
            file.message(
              `Use [link text](${url}) instead of <${url}> for better accessibility`,
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
