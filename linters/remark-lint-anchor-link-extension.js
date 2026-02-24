import { visit } from 'unist-util-visit'

const remarkLintAnchorLinkExtension = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    visit(tree, 'link', (node) => {
      const url = node.url || ''

      if (
        url.startsWith('http://') ||
        url.startsWith('https://') ||
        url.startsWith('mailto:') ||
        url.startsWith('tel:') ||
        url.startsWith('#') ||
        url === '' ||
        !url.includes('#')
      ) {
        return
      }

      const urlPath = url.split('#')[0].split('?')[0]
      if (!urlPath) return

      const ext = urlPath.match(/\.([^./]+)$/)
      if (ext && ext[1] !== 'md') return

      if (!urlPath.endsWith('.md')) {
        const anchor = url.split('#')[1]
        const cleanPath = urlPath.replace(/\/$/, '')

        // e.g. "page.md/" → just remove the trailing slash
        const suggestion = cleanPath.endsWith('.md')
          ? `${cleanPath}#${anchor}`
          : `${cleanPath}/index.md#${anchor}`

        const message = `Anchor link "${url}" must include the .md file before the #anchor. Use "${suggestion}" instead. Without .md, the sidenav will not work properly.`

        if (actualSeverity === 'error') {
          file.fail(message, node.position, 'remark-lint:anchor-link-extension')
        } else {
          file.message(message, node.position, 'remark-lint:anchor-link-extension')
        }
      }
    })
  }
}

export default remarkLintAnchorLinkExtension
