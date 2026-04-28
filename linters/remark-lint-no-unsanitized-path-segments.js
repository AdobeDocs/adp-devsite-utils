import path from 'path'

const RULE_ID = 'remark-lint:no-unsanitized-filename'

const POSITION = {
  start: { line: 1, column: 1 },
  end: { line: 1, column: 1 }
}

// Mirrors EDS @adobe/helix-shared-string sanitizeName exactly
function sanitizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function report(file, message, severity) {
  if (severity === 'error') {
    file.fail(message, POSITION, RULE_ID)
  } else {
    file.message(message, POSITION, RULE_ID)
  }
}

function validateSegment(segment, label, file, severity) {
  const sanitized = sanitizeName(segment)
  if (sanitized !== segment) {
    report(file, `${label} "${segment}" is not EDS-safe. EDS will normalize it to "${sanitized}", causing a deployment mismatch. Rename it to "${sanitized}".`, severity)
  }
}

const remarkLintNoUnsanitizedFilename = (severity = 'warning') => {
  return (tree, file) => {
    const actualSeverity = Array.isArray(severity) ? severity[0] : severity

    const filename = file.basename || (file.path ? path.basename(file.path) : null)

    if (!filename) {
      return
    }

    const filenameWithoutExt = filename.replace(/\.md$/, '')
    validateSegment(filenameWithoutExt, 'Filename', file, actualSeverity)
  }
}

export default remarkLintNoUnsanitizedPathSegments
