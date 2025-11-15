import { visit } from 'unist-util-visit'
import fs from 'node:fs'
import path from 'path'

const remarkLintRedoclyapiNoPathprefix = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the directory of the current file being processed
    const currentFileDir = file.dirname || (file.path ? path.dirname(file.path) : process.cwd())
    
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
              let searchPaths = []
              
              if (path.isAbsolute(srcValue)) {
                // Absolute path - try multiple common locations
                const projectRoot = process.cwd()
                searchPaths = [
                  path.join(projectRoot, srcValue.substring(1)), // Remove leading slash
                  path.join(projectRoot, 'src', 'pages', srcValue.substring(1)),
                  path.join(projectRoot, 'static', srcValue.substring(1)),
                  path.join(projectRoot, 'public', srcValue.substring(1))
                ]
              } else {
                // Relative path - check relative to current file and common locations
                searchPaths = [
                  path.resolve(currentFileDir, srcValue),
                  path.resolve(process.cwd(), srcValue),
                  path.resolve(process.cwd(), 'static', srcValue),
                  path.resolve(process.cwd(), 'public', srcValue)
                ]
              }
              
              // Check if any of the search paths exist
              const existingPath = searchPaths.find(p => fs.existsSync(p))
              
              if (!existingPath) {
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

                const message = `RedoclyAPI component references non-existent file: "${srcValue}" (searched: ${searchPaths.join(', ')})`

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
