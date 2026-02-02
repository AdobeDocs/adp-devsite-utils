import { visit } from 'unist-util-visit'

const remarkLintNoAltTextForImage = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    visit(tree, 'image', (node) => {
      if (!node.alt || node.alt.trim() === '') {
        const message = `Image is missing alt text: ${node.url}`
        
        if (actualSeverity === 'error') {
          file.fail(message, node.position, 'remark-lint:no-alt-text-for-image')
        } else {
          file.message(message, node.position, 'remark-lint:no-alt-text-for-image')
        }
      }
    })
  }
}

export default remarkLintNoAltTextForImage
