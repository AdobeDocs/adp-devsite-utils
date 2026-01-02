import { visit } from 'unist-util-visit'

const remarkLintNoBlockInList = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const content = file.toString()
    const lines = content.split('\n')

    // Pattern to match list items (unordered or ordered)
    const listPattern = /^(\s*)([*\-+]|\d+\.)\s+/
    
    // Pattern to match indented block tags
    const indentedBlockPattern = /^(\s+)<([a-zA-Z][a-zA-Z0-9_-]*)\s*([^>]*?)\s*\/>\s*$/

    let inCodeBlock = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Track code fence blocks
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock
        continue
      }

      // Skip lines inside code blocks
      if (inCodeBlock) {
        continue
      }

      // Check if this line is an indented block tag
      const blockMatch = line.match(indentedBlockPattern)
      if (blockMatch) {
        const blockName = blockMatch[2]
        const blockIndent = blockMatch[1].length

        // Look backwards to see if we're in a list
        for (let j = i - 1; j >= 0; j--) {
          const prevLine = lines[j]
          const prevTrimmed = prevLine.trim()

          // Skip blank lines
          if (prevTrimmed === '') {
            continue
          }

          // Check if previous line is a list item
          const listMatch = prevLine.match(listPattern)
          if (listMatch) {
            const listIndent = listMatch[1].length
            
            // If block is indented more than the list marker, it's nested
            if (blockIndent > listIndent) {
              const position = {
                start: { line: i + 1, column: 1 },
                end: { line: i + 1, column: line.length + 1 }
              }

              const message = `Nested block detected: <${blockName}/> is inside a list item. EDS does not support blocks nested in lists.`

              if (actualSeverity === 'error') {
                file.fail(message, position, 'remark-lint:no-block-in-list')
              } else {
                file.message(message, position, 'remark-lint:no-block-in-list')
              }
            }
            break
          }

          // If we hit a non-indented, non-blank line that's not a list, stop looking
          if (prevLine.length > 0 && prevLine[0] !== ' ' && prevLine[0] !== '\t') {
            break
          }
        }
      }
    }
  }
}

export default remarkLintNoBlockInList