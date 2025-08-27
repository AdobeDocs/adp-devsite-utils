import { visit } from 'unist-util-visit'

const remarkLintNoHtmlTags = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Custom components that are allowed
    const allowedComponents = [
      'herosimple', 'resources', 'inlinealert', 'getcredential',
      'discoverblock', 'announcement', 'carousel', 'summary',
      'infocard', 'embed', 'redoclyapiblock', 'codeblock',
      'list', 'horizontalline', 'tab', 'columns', 'details',
      'hero', 'title'
    ]

    // Visit all HTML nodes to find unauthorized HTML tags
    visit(tree, 'html', (node) => {
      const content = node.value

      // Check for any HTML tags that aren't custom components
      const htmlTagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*)?(\/?)\s*>/g
      let match

      while ((match = htmlTagRegex.exec(content)) !== null) {
        const [fullTag, isClosing, tagName, isSelfClosing] = match

        // Skip if this tag is in the allowed components list
        if (allowedComponents.includes(tagName.toLowerCase())) {
          continue
        }

        // This is an unauthorized HTML tag - flag it
        const position = {
          start: {
            line: node.position.start.line,
            column: node.position.start.column + match.index + 1
          },
          end: {
            line: node.position.start.line,
            column: node.position.start.column + match.index + fullTag.length
          }
        }

        let message = `HTML tag <${tagName}> is not allowed. Only custom components are permitted.`

        if (isClosing) {
          message = `HTML closing tag </${tagName}> is not allowed. Only custom components are permitted.`
        } else if (isSelfClosing || fullTag.endsWith('/>')) {
          message = `<${tagName}/> is not allowed. Only custom components are permitted.`
        }

        if (actualSeverity === 'error') {
          file.fail(message, position, 'remark-lint:no-html-tags')
        } else {
          file.message(message, position, 'remark-lint:no-html-tags')
        }
      }
    })
  }
}

export default remarkLintNoHtmlTags
