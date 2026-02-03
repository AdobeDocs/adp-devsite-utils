const remarkLintNoKebabInFilename = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the filename from the file path
    const filename = file.basename || (file.path ? file.path.split('/').pop() : null)

    if (!filename) {
      return
    }

    // Remove the .md extension for validation
    const filenameWithoutExt = filename.replace(/\.md$/, '')

    // Only allow lowercase letters, numbers, and hyphens
    const validFilenameRegex = /^[a-z0-9-]+$/

    if (!validFilenameRegex.test(filenameWithoutExt)) {
      // Find the invalid characters
      const invalidChars = filenameWithoutExt.match(/[^a-z0-9-]/g) || []
      const uniqueInvalidChars = [...new Set(invalidChars)]

      const position = {
        start: { line: 1, column: 1 },
        end: { line: 1, column: 1 }
      }

      const message = `Filename "${filename}" contains invalid character(s): ${uniqueInvalidChars.map(c => `"${c}"`).join(', ')}. Only lowercase letters (a-z), numbers (0-9), and hyphens (-) are allowed.`

      if (actualSeverity === 'error') {
        file.fail(message, position, 'remark-lint:no-kebab-in-filename')
      } else {
        file.message(message, position, 'remark-lint:no-kebab-in-filename')
      }
    }
  }
}

export default remarkLintNoKebabInFilename
