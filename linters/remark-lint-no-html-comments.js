const remarkLintNoHtmlComments = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const content = file.toString()
    const lines = content.split('\n')
    let inCodeBlock = false
    let inFrontmatter = false

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1
      const line = lines[i]
      const trimmed = line.trim()

      // Skip YAML frontmatter
      if (i === 0 && trimmed === '---') {
        inFrontmatter = true
        continue
      }
      if (inFrontmatter) {
        if (trimmed === '---') inFrontmatter = false
        continue
      }

      // Skip fenced code blocks
      if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
        inCodeBlock = !inCodeBlock
        continue
      }
      if (inCodeBlock) continue

      // Strip inline code spans to avoid false positives inside backticks
      const stripped = line.replace(/`[^`]*`/g, (m) => ' '.repeat(m.length))

      const htmlCommentRegex = /<!--.*?-->/g
      let match
      while ((match = htmlCommentRegex.exec(stripped)) !== null) {
        const position = {
          start: { line: lineNumber, column: match.index + 1 },
          end: { line: lineNumber, column: match.index + match[0].length + 1 }
        }
        const message =
          'HTML comments are not allowed. Use markdown comments instead or remove the comment.'
        if (actualSeverity === 'error') {
          file.fail(message, position, 'remark-lint:no-html-comments')
        } else {
          file.message(message, position, 'remark-lint:no-html-comments')
        }
      }
    }
  }
}

export default remarkLintNoHtmlComments
