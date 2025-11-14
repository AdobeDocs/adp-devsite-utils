import { visit } from 'unist-util-visit'
import fs from 'node:fs'
import path from 'path'

const remarkLintRedoclyapiNoPathprefix = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the directory of the current file being processed
    const currentFileDir = file.dirname || process.cwd()
    
    // Visit all HTML nodes to find redoclyapi components
    visit(tree, 'html', (node) => {
      const content = node.value

      // Check for redoclyapi components (case-insensitive)
      const redoclyapiRegex = /<redoclyapi(?:\s+[^>]*)?>/gi
      const matches = content.match(redoclyapiRegex)

      if (matches) {
        matches.forEach(match => {
          // Extract src attribute from the component
          const srcMatch = match.match(/src\s*=\s*["']([^"']+)["']/i)
          
          if (srcMatch) {
            const srcValue = srcMatch[1]
            
            // Skip URLs (http/https) and data URIs
            if (srcValue.match(/^(https?:|data:)/i)) {
              return
            }
            
            // Check if src starts with "pathprefix"
            if (srcValue.toLowerCase().startsWith('pathprefix')) {
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

              const message = `RedoclyAPI component src attribute should not start with "pathprefix". Found: "${srcValue}"`

              if (actualSeverity === 'error') {
                file.fail(
                  message,
                  position,
                  'remark-lint:redoclyapi-no-pathprefix'
                )
              } else {
                file.message(
                  message,
                  position,
                  'remark-lint:redoclyapi-no-pathprefix'
                )
              }
            } else {
              // Check if the file exists
              let filePath
              
              if (path.isAbsolute(srcValue)) {
                // Absolute path - check from project root
                const projectRoot = process.cwd()
                filePath = path.join(projectRoot, 'src', 'pages', srcValue.substring(1)) // Remove leading slash
              } else {
                // Relative path - check relative to current file
                filePath = path.resolve(currentFileDir, srcValue)
              }
              
              if (!fs.existsSync(filePath)) {
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

                const message = `RedoclyAPI component references non-existent file: "${srcValue}" (resolved to: ${filePath})`

                if (actualSeverity === 'error') {
                  file.fail(
                    message,
                    position,
                    'remark-lint:redoclyapi-file-exists'
                  )
                } else {
                  file.message(
                    message,
                    position,
                    'remark-lint:redoclyapi-file-exists'
                  )
                }
              }
            }
          }
        })
      }
    })
  }
}

export default remarkLintRedoclyapiNoPathprefix
