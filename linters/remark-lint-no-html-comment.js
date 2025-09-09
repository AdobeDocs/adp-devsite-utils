import { visit } from 'unist-util-visit'

const remarkLintNoHtmlComment = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity
    // Check for HTML comments
    const htmlCommentRegex = /<!--[\s\S]*?-->/g
    let commentMatch

    while ((commentMatch = htmlCommentRegex.exec(content)) !== null) {
      const [fullComment] = commentMatch

      const position = {
        start: {
          line: node.position.start.line,
          column: node.position.start.column + commentMatch.index + 1
        },
        end: {
          line: node.position.start.line,
          column: node.position.start.column + commentMatch.index + fullComment.length
        }
      }

      const message = 'HTML comments are not allowed. Use markdown comments instead or remove the comment.'

      if (actualSeverity === 'error') {
        file.fail(message, position, 'remark-lint:no-html-comments')
      } else {
        file.message(message, position, 'remark-lint:no-html-comments')
      }
    }
  }
}

export default remarkLintNoHtmlComment
