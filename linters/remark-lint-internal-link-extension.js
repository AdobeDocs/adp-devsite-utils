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

      // Skip links to non-page assets (images, PDFs, zips, etc.)
      const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.zip', '.json']
      if (assetExtensions.some((ext) => urlPath.toLowerCase().endsWith(ext))) {
        return
      }

      if (!urlPath.endsWith('.md')) {
        const linkText = node.children?.map((c) => c.value).join('') || ''
        const position = node.position

        const message = `Internal link "${url}" must end with .md. Use "${urlPath.replace(/\/$/, '')}/index.md${url.includes('#') ? '#' + url.split('#')[1] : ''}" or "${urlPath.replace(/\/$/, '')}.md${url.includes('#') ? '#' + url.split('#')[1] : ''}" instead.`

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
