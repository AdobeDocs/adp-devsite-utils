import { visit } from 'unist-util-visit'
import fs from 'node:fs'
import path from 'node:path'

const MAX_SIZE_MB = 20
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

const remarkLintBigImage = (severity = 'error') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity
    
    // Get the directory of the current markdown file
    const fileDir = file.dirname || (file.path ? path.dirname(file.path) : null)
    
    if (!fileDir) {
      return // Cannot check file sizes without knowing the file path
    }

    // Find the src/pages directory (site root) by walking up from the file directory
    let siteRoot = fileDir
    while (siteRoot && !siteRoot.endsWith('src/pages') && !siteRoot.endsWith('src\\pages')) {
      const parent = path.dirname(siteRoot)
      if (parent === siteRoot) break // Reached filesystem root
      siteRoot = parent
    }

    visit(tree, 'image', (node) => {
      const imageUrl = node.url
      
      // FIX ME: Skipped external URLs for now
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return
      }

      // Resolve the image path - handle both absolute (from site root) and relative paths
      let imagePath
      if (imageUrl.startsWith('/')) {
        // Absolute path from site root (src/pages)
        imagePath = path.join(siteRoot, imageUrl)
      } else {
        // Relative path from markdown file
        imagePath = path.resolve(fileDir, imageUrl)
      }
      
      let fileStats = null
      try {
        if (fs.existsSync(imagePath)) {
          fileStats = fs.statSync(imagePath)
        }
      } catch (error) {
        // Ignore file access errors (file doesn't exist, permission issues, etc.)
        return
      }

      if (fileStats && fileStats.size >= MAX_SIZE_BYTES) {
        const sizeMB = fileStats.size / (1024 * 1024)
        const message = `Image file is too large: ${imageUrl} (${sizeMB.toFixed(2)} MB >= ${MAX_SIZE_MB} MB)`
        
        if (actualSeverity === 'error') {
          file.fail(message, node.position, 'remark-lint:big-image')
        } else {
          file.message(message, node.position, 'remark-lint:big-image')
        }
      }
    })
  }
}

export default remarkLintBigImage
