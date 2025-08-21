#!/usr/bin/env node

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkLintNoMultipleToplevelHeadings from 'remark-lint-no-multiple-toplevel-headings';
import remarkValidateLinks from 'remark-validate-links';
import remarkLintNoHiddenTableCell from 'remark-lint-no-hidden-table-cell';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'node:fs';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

// Get the directory where this script is located (adp-devsite-utils repo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adpDevsiteUtilsDir = path.dirname(__dirname);

// Get the current working directory (target repo where the command is run)
const targetDir = process.cwd();

logSection('TEST LINT');
logStep('Testing remark rules with JavaScript API');

// Import the custom linter plugins
const remarkLintCheckFrontmatter = await import(path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-check-frontmatter.js'));
const remarkLintNoAngleBrackets = await import(path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-no-angle-brackets.js'));
const remarkLintSelfCloseComponent = await import(path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-self-close-component.js'));

// Create remark processor with all plugins
const processor = remark()
  .use(remarkValidateLinks)
  .use(remarkLintNoMultipleToplevelHeadings)
  .use(remarkGfm)
  .use(remarkLintNoHiddenTableCell, ['error'])
  .use(remarkLintNoAngleBrackets.default, ['error'])
  .use(remarkLintCheckFrontmatter.default)
  .use(remarkLintSelfCloseComponent.default, ['error']);

// Find all markdown files in src/pages
const srcPagesDir = path.join(targetDir, 'src', 'pages');

if (!fs.existsSync(srcPagesDir)) {
  log('❌ src/pages directory not found', 'error');
  process.exit(1);
}

// Find all markdown files recursively
function findMarkdownFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(fullPath));
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

const markdownFiles = findMarkdownFiles(srcPagesDir);

if (markdownFiles.length === 0) {
  log('No markdown files found in src/pages', 'warn');
  process.exit(0);
}

log(`Found ${markdownFiles.length} markdown files to test`);

// Process each file
let totalIssues = 0;
let filesWithIssues = 0;

for (const filePath of markdownFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(targetDir, filePath);

    verbose(`Processing: ${relativePath}`);

    // Process the file with remark
    const result = await processor.process(content);

    if (result.messages.length > 0) {
      filesWithIssues++;
      totalIssues += result.messages.length;

      console.log(`\n${relativePath}:`);

      // Display all messages for this file
      result.messages.forEach(message => {
        const severity = message.fatal ? '❌ ERROR' : '⚠️  WARNING';
        verbose(` ${severity} ${message}`);

        if (message.ruleId) {
          verbose(`    Rule: ${message.ruleId}`);
        }
      });
    } else {
      verbose(`✅ ${relativePath}: No issues found`);
    }

  } catch (error) {
    log(`❌ Error processing ${filePath}: ${error.message}`, 'error');
    totalIssues++;
  }
}
