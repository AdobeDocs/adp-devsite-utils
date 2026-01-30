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

    visit(tree, 'image', (node) => {
      const imageUrl = node.url
      
      // Skip external URLs
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return
      }

      // Resolve the image path relative to the markdown file
      const imagePath = path.resolve(fileDir, imageUrl)
      
      try {
        if (fs.existsSync(imagePath)) {
          const stats = fs.statSync(imagePath)
          const sizeMB = stats.size / (1024 * 1024)
          
          if (stats.size >= MAX_SIZE_BYTES) {
            const message = `Image file is too large: ${imageUrl} (${sizeMB.toFixed(2)} MB >= ${MAX_SIZE_MB} MB)`
            
            if (actualSeverity === 'error') {
              file.fail(message, node.position, 'remark-lint:big-image')
            } else {
              file.message(message, node.position, 'remark-lint:big-image')
            }
          }
        }
      } catch (error) {
        // Silently ignore file access errors
      }
    })
  }
}

export default remarkLintBigImage
