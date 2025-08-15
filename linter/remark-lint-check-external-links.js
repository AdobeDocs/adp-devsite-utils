import { visit } from 'unist-util-visit'

const remarkLintCheckDeadLinks = () => {
  return async (tree, file) => {
    const deadLinks = []

    // Collect all external links first
    visit(tree, 'link', (node) => {
      const url = node.url

      // Skip empty or non-external links
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return
      }

      // Skip localhost and other local URLs
      if (url.includes('localhost') || url.includes('127.0.0.1')) {
        return
      }

      deadLinks.push({
        node,
        url
      })
    })

    // Check each link asynchronously
    for (const { node, url } of deadLinks) {
      try {
        const response = await fetch(url, {
          method: 'HEAD', // Use HEAD request to avoid downloading content
          redirect: 'follow',
          timeout: 10000 // 10 second timeout
        })

        if (!response.ok) {
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

          file.message(
            `Dead link (HTTP ${response.status}): "${url}"`,
            position,
            'remark-lint:check-dead-links'
          )
        }
      } catch (error) {
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

        file.message(
          `Failed to check link: "${url}" - ${error.message}`,
          position,
          'remark-lint:check-dead-links'
        )
      }
    }
  }
}

export default remarkLintCheckDeadLinks
