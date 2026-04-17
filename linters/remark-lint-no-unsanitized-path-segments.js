import path from 'path'

const RULE_ID = 'remark-lint:no-unsanitized-path-segments'

const POSITION = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 }
}

function report(file, message, severity) {
  if (severity === 'error') {
    file.fail(message, POSITION, RULE_ID)
  } else {
    file.message(message, POSITION, RULE_ID)
  }
}

function validateSegment(segment, label, file, severity) {
  const validCharsRegex = /^[a-z0-9-]+$/
  if (!validCharsRegex.test(segment)) {
    const invalidChars = segment.match(/[^a-z0-9-]/g) || []
    const unique = [...new Set(invalidChars)]
    report(file, `${label} "${segment}" contains invalid character(s): ${unique.map(c => `"${c}"`).join(', ')}. Only lowercase letters (a-z), numbers (0-9), and hyphens (-) are allowed.`, severity)
  }

  if (/--/.test(segment)) {
    report(file, `${label} "${segment}" contains consecutive dashes (--). EDS normalizes consecutive dashes into a single dash, which will cause deployment failures.`, severity)
  }

  if (segment.startsWith('-') || segment.endsWith('-')) {
    report(file, `${label} "${segment}" has a leading or trailing dash. EDS strips leading/trailing dashes, which will cause deployment failures.`, severity)
  }
}

const remarkLintNoUnsanitizedPathSegments = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const filename = file.basename || (file.path ? path.basename(file.path) : null)

    if (!filename) {
      return
    }

    const filenameWithoutExt = filename.replace(/\.md$/, '')
    validateSegment(filenameWithoutExt, 'Filename', file, actualSeverity)

    if (file.path) {
      const srcPagesMarker = path.join('src', 'pages')
      const srcPagesIndex = file.path.indexOf(srcPagesMarker)
      if (srcPagesIndex !== -1) {
        const relativePath = file.path.slice(srcPagesIndex + srcPagesMarker.length + path.sep.length)
        const segments = relativePath.split(path.sep)
        segments.pop() // remove filename (already checked above)
        for (const dir of segments) {
          if (dir) {
            validateSegment(dir, 'Directory', file, actualSeverity)
          }
        }
      }
    }
  }
}

export default remarkLintNoUnsanitizedPathSegments
