import { visit } from 'unist-util-visit'

const remarkLintNoAngleBrackets = (severity = 'warning') => {
  return (tree, file) => {
    // Visit all nodes to find angle bracket links
    visit(tree, (node) => {
      if (node.type === 'link') {
        // Check if this link has no text (just URL) which suggests angle bracket syntax
        if (node.children && node.children.length === 1 && node.children[0].type === 'text') {
          const linkText = node.children[0].value
          const url = node.url

          // If the link text is the same as the URL, it might be using angle bracket syntax
          if (linkText === url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('www.'))) {
            const position = {
              start: {
                line: node.position.start.line,
                column: node.position.start.column
              },
              end: {
                line: node.position.end.line,
                column: node.position.end.column
              }
            }

            if (severity === 'error') {
              file.fail(
                `Use [link text](${url}) instead of <${url}> for better accessibility`,
                position
              )
            } else {
              file.message(
                `Use [link text](${url}) instead of <${url}> for better accessibility`,
                position,
                'remark-lint:no-angle-brackets')
            }
          }
        }
      }
    })
  }
}

export default remarkLintNoAngleBrackets
