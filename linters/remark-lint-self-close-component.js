import { visit } from 'unist-util-visit'

const remarkLintSelfCloseComponent = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity
    
    // Custom components that must be self-closing
    const customComponents = [
      'herosimple', 'resources', 'inlinealert', 'getcredential',
      'discoverblock', 'announcement', 'carousel', 'summary',
      'infocard', 'embed', 'redoclyapiblock', 'codeblock',
      'list', 'horizontalline', 'tab', 'columns', 'details'
    ]

    // Visit all HTML nodes to find custom component tags
    visit(tree, 'html', (node) => {
      const content = node.value
      
      // First, check for any HTML tags that aren't custom components
      const htmlTagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)(?:\s+[^>]*)?(\/?)\s*>/g
      let match
      
      while ((match = htmlTagRegex.exec(content)) !== null) {
        const [fullTag, isClosing, tagName, isSelfClosing] = match
        
        // Skip if this tag is in the custom components list
        if (customComponents.includes(tagName.toLowerCase())) {
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
          message = `HTML self-closing tag <${tagName}/> is not allowed. Only custom components are permitted.`
        }
        
        if (actualSeverity === 'error') {
          file.fail(message, position, 'remark-lint:self-close-component')
        } else {
          file.message(message, position, 'remark-lint:self-close-component')
        }
      }
      
      // Now check for opening tags of custom components (existing logic)
      for (const component of customComponents) {
        // Case-insensitive regex for component names
        const openingTagRegex = new RegExp(`<${component}(?:\\s+[^>]*)?>`, 'gi')
        const closingTagRegex = new RegExp(`</${component}>`, 'gi')
        
        // Check if this is an opening tag (but not self-closing)
        const openingMatch = content.match(openingTagRegex)
        const hasOpeningTag = openingMatch !== null
        
        if (hasOpeningTag && !content.includes('/>')) {
          // Check if this single node contains both opening and closing tags
          const closingMatch = content.match(closingTagRegex)
          const hasClosingTag = closingMatch !== null

          if (hasClosingTag) {
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

            // Get the actual component name from the content for better error message
            const match = content.match(new RegExp(`<(${component})(?:\\s+[^>]*)?>`, 'i'))
            const actualComponentName = match ? match[1] : component

            if (actualSeverity === 'error') {
              file.fail(
                `Custom component "${actualComponentName}" should be self-closing (use <${actualComponentName} /> instead of <${actualComponentName}>...</${actualComponentName}>).`,
                position,
                'remark-lint:self-close-component'
              )
            } else {
              file.message(
                `Custom component "${actualComponentName}" should be self-closing (use <${actualComponentName} /> instead of <${actualComponentName}>...</${actualComponentName}>).`,
                position,
                'remark-lint:self-close-component'
              )
            }
          } else {
            // Look ahead in the tree to see if there's a corresponding closing tag
            let hasClosingTag = false

            // Search through the tree for a closing tag
            visit(tree, 'html', (searchNode) => {
              if (searchNode === node) return // Skip the current node

              const searchContent = searchNode.value
              if (closingTagRegex.test(searchContent)) {
                hasClosingTag = true
                return false // Stop searching
              }
            })

            if (hasClosingTag) {
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

              // Get the actual component name from the content for better error message
              const match = content.match(new RegExp(`<(${component})(?:\\s+[^>]*)?>`, 'i'))
              const actualComponentName = match ? match[1] : component

              if (actualSeverity === 'error') {
                file.fail(
                  `Custom component "${actualComponentName}" should be self-closing (use <${actualComponentName} /> instead of <${actualComponentName}>...</${actualComponentName}>).`,
                  position,
                  'remark-lint:self-close-component'
                )
              } else {
                file.message(
                  `Custom component "${actualComponentName}" should be self-closing (use <${actualComponentName} /> instead of <${actualComponentName}>...</${actualComponentName}>).`,
                  position,
                  'remark-lint:self-close-component'
                )
              }
            }
          }
        }
      }
    })
  }
}

export default remarkLintSelfCloseComponent
