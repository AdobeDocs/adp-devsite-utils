import { visit } from 'unist-util-visit'

const remarkLintNoDetailsHtml = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const content = file.toString()
    const lines = content.split('\n')

    for (let lineNumber = 1; lineNumber <= lines.length; lineNumber++) {
      const line = lines[lineNumber - 1]

      const detailsOpenRegex = /<details(?:\s[^>]*)?\s*>/gi
      let match

      while ((match = detailsOpenRegex.exec(line)) !== null) {
        const fullTag = match[0]

        if (/\/\s*>$/.test(fullTag)) {
          continue
        }

        const position = {
          start: { line: lineNumber, column: match.index + 1 },
          end: { line: lineNumber, column: match.index + fullTag.length + 1 }
        }

        const message =
          'HTML <details> element is not supported in EDS. Replace with the Details EDS block.\n' +
          'Example: <Details slots="heading, list" repeat="1" summary="Text Description" subText="Description" />\n' +
          'See: https://github.com/AdobeDocs/dev-docs-reference/blob/main/src/pages/getting-started/dev-docs/best-practices/index.md'

        if (actualSeverity === 'error') {
          file.fail(message, position, 'remark-lint:no-details-html')
        } else {
          file.message(message, position, 'remark-lint:no-details-html')
        }
      }
    }
  }
}

export default remarkLintNoDetailsHtml
