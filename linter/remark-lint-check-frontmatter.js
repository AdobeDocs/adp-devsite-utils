import { visit } from 'unist-util-visit'

const remarkLintCheckFrontmatter = (severity = 'warning') => {
  return (tree, file) => {
    console.log(`🔍 Frontmatter linter called with severity: "${severity}"`)

    let hasFrontmatter = false
    let frontmatterNode = null

    // Find the frontmatter node
    visit(tree, 'yaml', (node) => {
      hasFrontmatter = true
      frontmatterNode = node
    })

    if (!hasFrontmatter) {
      console.log(`❌ No frontmatter found, severity is: "${severity}"`)
      if (severity === 'error') {
        console.log('🚨 Calling file.fail() for missing frontmatter')
        file.fail(
          'Missing frontmatter section - add --- at the beginning with title and description',
          {line: 1, column: 1},
          'remark-lint:check-frontmatter'
        )
        return
      } else {
        console.log('⚠️  Calling file.message() for missing frontmatter')
        file.message(
          'Missing frontmatter section - add --- at the beginning with title and description',
          {line: 1, column: 1},
          'remark-lint:check-frontmatter'
        )
        return
      }
    }

    try {
      // Parse the YAML content
      const yamlContent = frontmatterNode.value
      const lines = yamlContent.split('\n')

      let title = null
      let description = null
      let titleLine = 0
      let descriptionLine = 0

      // Check each line for title and description
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        if (line.startsWith('title:')) {
          title = line.substring(6).trim()
          titleLine = i + 1
          // Remove quotes if present
          if ((title.startsWith('"') && title.endsWith('"')) ||
              (title.startsWith("'") && title.endsWith("'"))) {
            title = title.slice(1, -1)
          }
        }

        if (line.startsWith('description:')) {
          description = line.substring(12).trim()
          descriptionLine = i + 1
          // Remove quotes if present
          if ((description.startsWith('"') && description.endsWith('"')) ||
              (description.startsWith("'") && description.endsWith("'"))) {
            description = description.slice(1, -1)
          }
        }
      }

      // Check if title exists and is not empty
      if (!title || title === '') {
        const position = {
          start: {
            line: frontmatterNode.position.start.line + titleLine,
            column: frontmatterNode.position.start.column
          },
          end: {
            line: frontmatterNode.position.start.line + titleLine,
            column: frontmatterNode.position.start.column + 6
          }
        }

        if (severity === 'error') {
          file.fail(
            'Missing or empty title in frontmatter',
            position,
            'remark-lint:check-frontmatter'
          )
        } else {
          file.message(
            'Missing or empty title in frontmatter',
            position,
            'remark-lint:check-frontmatter'
          )
        }
      } else {
        console.log(`  ✅ Found title: "${title}"`)
      }

      // Check if description exists and is not empty
      if (!description || description === '') {
        const position = {
          start: {
            line: frontmatterNode.position.start.line + descriptionLine,
            column: frontmatterNode.position.start.column
          },
          end: {
            line: frontmatterNode.position.start.line + descriptionLine,
            column: frontmatterNode.position.start.column + 12
          }
        }

        if (severity === 'error') {
          file.fail(
            'Missing or empty description in frontmatter',
            position,
            'remark-lint:check-frontmatter'
          )
        } else {
          file.message(
            'Missing or empty description in frontmatter',
            position,
            'remark-lint:check-frontmatter'
          )
        }
      } else {
        console.log(`  ✅ Found description: "${description}"`)
      }

      // Additional validation: check title length
      if (title && title.length > 60) {
        const position = {
          start: {
            line: frontmatterNode.position.start.line + titleLine,
            column: frontmatterNode.position.start.column
          },
          end: {
            line: frontmatterNode.position.start.line + titleLine,
            column: frontmatterNode.position.start.column + 6
          }
        }

        if (severity === 'error') {
          file.fail(
            `Title is too long (${title.length} characters). Consider keeping it under 60 characters.`,
            position,
            'remark-lint:check-frontmatter'
          )
        } else {
          file.message(
            `Title is too long (${title.length} characters). Consider keeping it under 60 characters.`,
            position,
            'remark-lint:check-frontmatter'
          )
        }
      }

      // Additional validation: check description length
      if (description && description.length > 160) {
        const position = {
          start: {
            line: frontmatterNode.position.start.line + descriptionLine,
            column: frontmatterNode.position.start.column
          },
          end: {
            line: frontmatterNode.position.start.line + descriptionLine,
            column: frontmatterNode.position.start.column + 12
          }
        }

        if (severity === 'error') {
          file.fail(
            `Description is too long (${description.length} characters). Consider keeping it under 160 characters.`,
            position,
            'remark-lint:check-frontmatter'
          )
        } else {
          file.message(
            `Description is too long (${description.length} characters). Consider keeping it under 160 characters.`,
            position,
            'remark-lint:check-frontmatter'
          )
        }
      }

    } catch (error) {
      file.message(
        `Error parsing frontmatter: ${error.message}`,
        frontmatterNode.position,
        'remark-lint:check-frontmatter'
      )
    }

    console.log('✅ Frontmatter validation complete!')
  }
}

export default remarkLintCheckFrontmatter
