import { visit } from 'unist-util-visit'

const remarkLintNoAngleBrackets = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Simple line-by-line scanning approach (more reliable than AST parsing)
    const content = file.toString()
    const lines = content.split('\n')
    
    for (let lineNumber = 1; lineNumber <= lines.length; lineNumber++) {
      const line = lines[lineNumber - 1]
      const trimmedLine = line.trim()

      // Check for links enclosed with <> instead of []
      const angleBracketLinks = trimmedLine.match(/<([^>]+)>/g)
      if (angleBracketLinks) {
        for (const link of angleBracketLinks) {
          // Extract the content inside the brackets
          const content = link.replace(/^<|>$/g, '')

          // Check if it's a URL (starts with http, https, www, or mailto)
          if (content.match(/^(https?:\/\/|www\.|mailto:)/)) {
            const position = {
              start: {
                line: lineNumber,
                column: line.indexOf(link) + 1
              },
              end: {
                line: lineNumber,
                column: line.indexOf(link) + link.length
              }
            }

            if (actualSeverity === 'error') {
              file.fail(
                `Link "${link}" uses angle brackets <>. Consider using square brackets [] instead for better markdown compatibility.`,
                position,
                'remark-lint:no-angle-brackets'
              )
            } else {
              file.message(
                `Link "${link}" uses angle brackets <>. Consider using square brackets [] instead for better markdown compatibility.`,
                position,
                'remark-lint:no-angle-brackets'
              )
            }
          }
        }
      }
    }
  }
}

export default remarkLintNoAngleBrackets
