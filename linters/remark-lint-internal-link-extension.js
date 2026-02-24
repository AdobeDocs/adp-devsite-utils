import { visit } from 'unist-util-visit'

const remarkLintInternalLinkExtension = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    visit(tree, 'link', (node) => {
      const url = node.url || ''

      // Skip external links, anchors-only, and mailto/tel links
      if (
        url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('#') ||
        url === ''
      ) {
        return
      }

      // Strip anchor fragment and query string for extension check
      const urlPath = url.split('#')[0].split('?')[0]

      if (!urlPath) return

      // Only flag links that look like they should point to a .md page
      const ext = urlPath.match(/\.([^./]+)$/)
      if (ext && ext[1] !== 'md') return

      if (!urlPath.endsWith('.md')) {
        const position = node.position

        const message = `Internal link "${url}" must end with .md. Run "npm run normalizeLinks" to fix automatically, or manually change to "${urlPath.replace(/\/$/, '')}/index.md${url.includes('#') ? '#' + url.split('#')[1] : ''}" or "${urlPath.replace(/\/$/, '')}.md${url.includes('#') ? '#' + url.split('#')[1] : ''}".`

        if (actualSeverity === 'error') {
          file.fail(message, position, 'remark-lint:internal-link-extension')
        } else {
          file.message(message, position, 'remark-lint:internal-link-extension')
        }
      }
    })
  }
}

export default remarkLintInternalLinkExtension
