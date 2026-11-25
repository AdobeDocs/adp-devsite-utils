import { visit } from 'unist-util-visit'

const remarkLintNoUnescapedBr = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity
    const source = file.toString()

    // Breaks inside code or frontmatter are literal examples, not page content.
    const ignoredRanges = []
    visit(tree, (node) => {
      if (['code', 'inlineCode', 'yaml'].includes(node.type) && node.position) {
        ignoredRanges.push([node.position.start.offset, node.position.end.offset])
      }
    })

    const lineStarts = [0]
    for (const newline of source.matchAll(/\r\n|\n|\r/g)) {
      lineStarts.push(newline.index + newline[0].length)
    }
    const toPoint = (offset) => {
      let line = lineStarts.length - 1
      while (lineStarts[line] > offset) line--
      return { line: line + 1, column: offset - lineStarts[line] + 1 }
    }

    // Matches <br>, <br/>, <br />, and the malformed <br/\> that breaks deployment.
    const brTagRegex = /<br\s*\/?\\?>/gi
    let match

    while ((match = brTagRegex.exec(source)) !== null) {
      const offset = match.index
      if (ignoredRanges.some(([start, end]) => offset >= start && offset < end)) continue

      let backslashes = 0
      for (let index = offset - 1; index >= 0 && source[index] === '\\'; index--) {
        backslashes++
      }
      if (backslashes % 2 === 1) continue

      const position = {
        start: toPoint(offset),
        end: toPoint(offset + match[0].length)
      }
      const message = 'Unescaped <br> tag found. Use \\<br/> to escape it.'

      if (actualSeverity === 'error') {
        file.fail(message, position, 'remark-lint:no-unescaped-br')
      } else {
        file.message(message, position, 'remark-lint:no-unescaped-br')
      }
    }
  }
}

export default remarkLintNoUnescapedBr
