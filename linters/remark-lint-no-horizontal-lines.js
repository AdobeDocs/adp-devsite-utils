import { visit } from 'unist-util-visit'

const remarkLintNoHorizontalLines = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const source = file.toString()
    const lines = source.split('\n')

    visit(tree, 'thematicBreak', (node) => {
      const line = lines[node.position.start.line - 1]
      if (!/^-{3,}\s*$/.test(line)) return

      const message =
        '`---` is not supported as a horizontal rule in EDS. ' +
        'Replace with `<HorizontalLine />`.'

      if (actualSeverity === 'error') {
        file.fail(message, node.position, 'remark-lint:no-horizontal-lines')
      } else {
        file.message(message, node.position, 'remark-lint:no-horizontal-lines')
      }
    })
  }
}

export default remarkLintNoHorizontalLines
