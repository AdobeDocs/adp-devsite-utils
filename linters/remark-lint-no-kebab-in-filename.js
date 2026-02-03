const remarkLintNoUnderlineInFilename = (severity = 'warning') => {
  return (tree, file) => {
    // Handle both array format [severity] and direct severity string
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    // Get the filename from the file path
    const filename = file.basename || (file.path ? file.path.split('/').pop() : null)

    if (!filename) {
      return
    }

    // Check if the filename contains an underscore
    if (filename.includes('_')) {
      const position = {
        start: { line: 1, column: 1 },
        end: { line: 1, column: 1 }
      }

      const message = `Filename "${filename}" contains underscore(s). Please use hyphens (-) instead of underscores (_) in filenames.`

      if (actualSeverity === 'error') {
        file.fail(message, position, 'remark-lint:no-underline-in-filename')
      } else {
        file.message(message, position, 'remark-lint:no-underline-in-filename')
      }
    }
  }
}

export default remarkLintNoUnderlineInFilename
