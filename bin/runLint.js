#!/usr/bin/env node

import { remark } from 'remark';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkLintNoMultipleToplevelHeadings from 'remark-lint-no-multiple-toplevel-headings';
import remarkValidateLinks from 'remark-validate-links';
import remarkLintNoHiddenTableCell from 'remark-lint-no-hidden-table-cell';
import remarkLintNoDeadUrls from 'remark-lint-no-dead-urls';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'node:fs';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

// Report collection for linter-report.txt
const reportLines = [];
function addToReport(message) {
    reportLines.push(message);
}

// Get the directory where this script is located (adp-devsite-utils repo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adpDevsiteUtilsDir = path.dirname(__dirname);

// Get the current working directory (target repo where the command is run)
const targetDir = process.cwd();

// Read lint configuration from content repo's package.json
let skipUrlPatterns = [];
let skipFrontmatterPaths = [];
const packageJsonPath = path.join(targetDir, 'package.json');
if (fs.existsSync(packageJsonPath)) {
    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        skipUrlPatterns = packageJson?.lint?.skipUrlPatterns || [];
        skipFrontmatterPaths = packageJson?.lint?.skipFrontmatterPaths || [];

        if (skipUrlPatterns.length > 0) {
            logStep(`Skipping ${skipUrlPatterns.length} URL pattern(s):`);
            skipUrlPatterns.forEach(pattern => verbose(`  - ${pattern}`));
        }

        if (skipFrontmatterPaths.length > 0) {
            logStep(`Skipping frontmatter check for ${skipFrontmatterPaths.length} path(s):`);
            skipFrontmatterPaths.forEach(pattern => verbose(`  - ${pattern}`));
        }
    } catch (error) {
        log(`Failed to parse package.json: ${error.message}`, 'warn');
    }
}

// Helper function to check if a file should skip frontmatter check
function shouldSkipFrontmatter(filePath) {
    const relativePath = path.relative(targetDir, filePath);
    return skipFrontmatterPaths.some(pattern => relativePath.startsWith(pattern));
}

// Check for flags (support both new and deprecated names)
const externalLinksOnly = process.argv.includes('--external-links-only') || process.argv.includes('--dead-links-only');
const internalLinksOnly = process.argv.includes('--internal-links-only');
const skipDeadLinks = process.argv.includes('--skip-dead-links');
const linksOnlyMode = externalLinksOnly || internalLinksOnly;

logSection('TEST LINT');

// Determine lint mode for report
let lintMode = 'Full Linting (all rules + dead links check)';
if (linksOnlyMode) {
    const modes = [];
    if (externalLinksOnly) modes.push('external');
    if (internalLinksOnly) modes.push('internal');
    logStep(`Testing dead links (${modes.join(' + ')})`);
    lintMode = `Dead Links Only (${modes.join(' + ')})`;
} else if (skipDeadLinks) {
    logStep('Testing remark rules (skipping dead links check)');
    lintMode = 'Remark Rules Only (dead links skipped)';
} else {
    logStep('Testing remark rules with JavaScript API');
}

// Add report header
addToReport('═══════════════════════════════════════════════════════════════');
addToReport('                     LINTER REPORT');
addToReport('═══════════════════════════════════════════════════════════════');
addToReport('');
addToReport(`Generated: ${new Date().toISOString()}`);
addToReport(`Mode: ${lintMode}`);
addToReport(`Target Directory: ${targetDir}`);
addToReport('');
addToReport('───────────────────────────────────────────────────────────────');

// Import the custom linter plugins
const remarkLintCheckFrontmatter = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-check-frontmatter.js'));
const remarkLintNoAngleBrackets = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-angle-brackets.js'));
//const remarkLintHtmlCheck = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-html-check.js'));
const remarkLintSelfCloseComponent = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-self-close-component.js'));
const remarkLintNoHtmlTag = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-html-tags.js'));
const remarkLintNoCodeTable = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-code-in-table.js'));
const remarkLintNoHtmlComments = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-html-comments.js'));
const remarkLintNoBrInTables = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-br-in-tables.js'))
const remarkLintNoBlockInList = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-block-in-list.js'))
const remarkLintNoUnescapedOpeningCurlyBraces = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-unescaped-opening-curly-braces.js'))
const remarkLintNoAltTextForImage = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-alt-text-for-image.js'))
const remarkLintBigImage = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-big-image.js'))
const remarkLintNoKebabInFilename = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-kebab-in-filename.js'))
const remarkLintInternalLinkExtension = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-internal-link-extension.js'))
const remarkLintAnchorLinkExtension = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-anchor-link-extension.js'))
const remarkLintNoDetailsHtml = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-details-html.js'))
const remarkLintNoBracketInTable = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-bracket-in-table.js'))
const remarkLintNoHorizontalLines = await import(path.join(adpDevsiteUtilsDir, 'linters', 'remark-lint-no-horizontal-lines.js'))
const lintNoJsonInSrcPages = await import(path.join(adpDevsiteUtilsDir, 'linters', 'lint-no-json-in-src-pages.js'));
// Find all markdown files in src/pages
const srcPagesDir = path.join(targetDir, 'src', 'pages');

// Plugin that prevents file.fail() from throwing so all errors are collected
function remarkCollectAllErrors() {
  return (tree, file) => {
    file.fail = function(reason, options, origin) {
      const msg = file.message(reason, options, origin);
      msg.fatal = true;
      return msg;
    };
  };
}

// Create remark processor with plugins
// Two processors: one with frontmatter check and one without
function createProcessor(includeFrontmatterCheck) {
  let processors = remark()
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkCollectAllErrors);

  if (linksOnlyMode) {
    // Check internal links (local filesystem) when --internal-links-only is set
    if (internalLinksOnly) {
      processors = processors
        .use(remarkValidateLinks, {
          skipPathPatterns: [/.*config\.md.*/],
          root: srcPagesDir
        });
    }
    // Check external dead URLs (HTTP) when --external-links-only is set
    if (externalLinksOnly) {
      processors = processors
        .use(remarkLintNoDeadUrls, {
          skipUrlPatterns,
          deadOrAliveOptions: {
            maxRetries: 0, // Disable retries
            sleep: 0, // Disable sleep
            https: {
              rejectUnauthorized: false, // Don't fail on SSL cert issues
            },
            followRedirect: true, // Allow redirects (don't treat as dead links)
          },
        });
    }
  } else {
    // Run all linting rules (optionally skipping dead links)
    processors = processors
      .use(remarkValidateLinks, {
        skipPathPatterns: [/.*config\.md.*/],
        root: srcPagesDir
      })
      .use(remarkLintNoMultipleToplevelHeadings)
      .use(remarkGfm)
      .use(remarkLintNoHiddenTableCell, ['error'])
      .use(remarkLintNoAngleBrackets.default, ['error'])
      .use(remarkLintNoHtmlComments.default, ['error'])
      .use(remarkLintNoBrInTables.default, ['error'])
      .use(remarkLintNoBlockInList.default, ['error']);

    // Only add frontmatter check if not skipping
    if (includeFrontmatterCheck) {
      processors = processors.use(remarkLintCheckFrontmatter.default);
    }

    processors = processors
      .use(remarkLintNoDetailsHtml.default, ['error'])
      .use(remarkLintSelfCloseComponent.default, ['error'])
      .use(remarkLintNoHtmlTag.default, ['error'])
      .use(remarkLintNoCodeTable.default, ['error'])
      .use(remarkLintNoBracketInTable.default, ['error'])
      .use(remarkLintNoUnescapedOpeningCurlyBraces.default, ['error'])
      .use(remarkLintNoAltTextForImage.default, ['warning'])
      .use(remarkLintNoKebabInFilename.default, ['error'])
      .use(remarkLintInternalLinkExtension.default, ['error'])
      .use(remarkLintAnchorLinkExtension.default, ['error'])
      .use(remarkLintNoHorizontalLines.default, ['error']);

    // Add dead links check unless explicitly skipped
    if (!skipDeadLinks) {
      processors = processors
        .use(remarkLintNoDeadUrls, {
            skipUrlPatterns,
            deadOrAliveOptions: {
                maxRetries: 0, // Disable retries
                sleep: 0, // Disable sleep
                https: {
                    rejectUnauthorized: false, // Don't fail on SSL cert issues
                },
                followRedirect: true, // Allow redirects (don't treat as dead links)
            },
        });
    }
  }

  return processors;
}

// Create both processors
const processorWithFrontmatter = createProcessor(true);
const processorWithoutFrontmatter = createProcessor(false);

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
            // Skip config.md files
            if (entry.name !== 'config.md') {
                files.push(fullPath);
            }
        }
    }

    return files;
}

const markdownFiles = findMarkdownFiles(srcPagesDir);

if (markdownFiles.length === 0) {
    log('No markdown files found in src/pages', 'warn');
    process.exit(0);
}

verbose(`Found ${markdownFiles.length} markdown files to test`);
addToReport('');
addToReport(`Files to process: ${markdownFiles.length}`);
addToReport('');

// Process each file
let totalIssues = 0;
let filesWithIssues = 0;
let hasFatalErrors = false;
let totalErrors = 0;
let totalWarnings = 0;

// Pre-check: detect JSON files in src/pages/
const jsonCheckResult = lintNoJsonInSrcPages.default(srcPagesDir, targetDir);
if (jsonCheckResult.messages.length > 0) {
    addToReport('───────────────────────────────────────────────────────────────');
    addToReport('📁 JSON FILES IN src/pages/');
    addToReport('───────────────────────────────────────────────────────────────');

    for (const msg of jsonCheckResult.messages) {
        log(`❌ JSON file found in src/pages: ${msg.file}`, 'error');
        addToReport(`  ❌ ERROR`);
        addToReport(`    File: ${msg.file}`);
        addToReport(`    Message: ${msg.message}`);
        addToReport(`    Rule: ${msg.ruleId}`);
        addToReport('');
        totalIssues++;
        totalErrors++;
        filesWithIssues++;
        hasFatalErrors = true;
    }
}

for (const filePath of markdownFiles) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = path.relative(targetDir, filePath);

        // Choose the appropriate processor based on whether frontmatter check should be skipped
        const skipFrontmatter = shouldSkipFrontmatter(filePath);
        const processor = skipFrontmatter ? processorWithoutFrontmatter : processorWithFrontmatter;

        if (skipFrontmatter) {
            verbose(`Processing (skip frontmatter): ${relativePath}`);
        } else {
            verbose(`Processing: ${relativePath}`);
        }

        // Process the file with remark (pass path for linters that need filename access)
        const result = await processor.process({ path: filePath, value: content });

        if (result.messages.length > 0) {
            filesWithIssues++;
            totalIssues += result.messages.length;

            const hasErrors = result.messages.some(m => m.fatal);
            if (hasErrors) {
                log(`\n${relativePath}:`);
            } else {
                verbose(`\n${relativePath}:`);
            }

            // Add file header to report
            addToReport('───────────────────────────────────────────────────────────────');
            addToReport(`📄 FILE: ${relativePath}`);
            addToReport('───────────────────────────────────────────────────────────────');

            // Display all messages for this file
            result.messages.forEach(message => {
                const severity = message.fatal ? '❌ ERROR' : '⚠️  WARNING';
                const logFn = message.fatal ? log : verbose;
                logFn(` ${severity} ${message}`);

                // Track error/warning counts
                if (message.fatal) {
                    hasFatalErrors = true;
                    totalErrors++;
                } else {
                    totalWarnings++;
                }

                // Add to report with detailed formatting
                const msgLine = message.line || message.place?.start?.line || message.place?.line;
                const msgCol = message.column || message.place?.start?.column || message.place?.column;
                const location = msgLine ? `Line ${msgLine}${msgCol ? `:${msgCol}` : ''}` : 'N/A';
                addToReport(`  ${severity}`);
                addToReport(`    Location: ${location}`);
                addToReport(`    Message: ${message.message || message}`);
                if (message.ruleId) {
                    addToReport(`    Rule: ${message.ruleId}`);
                    logFn(`    Rule: ${message.ruleId}`);
                }
                addToReport('');
            });
        } else {
            verbose(`✅ ${relativePath}: No issues found`);
        }

    } catch (error) {
        log(`❌ Error processing ${filePath}: ${error}`, 'error');
        totalIssues++;
        totalErrors++;
        hasFatalErrors = true;

        // Add processing error to report
        const relativePath = path.relative(targetDir, filePath);
        addToReport('───────────────────────────────────────────────────────────────');
        addToReport(`📄 FILE: ${relativePath}`);
        addToReport('───────────────────────────────────────────────────────────────');
        addToReport(`  ❌ ERROR`);
        addToReport(`    Message: Failed to process file - ${error.message || error}`);
        addToReport('');
    }
}

// Summary and exit
log(`\n📊 Linting Summary:`);
log(`   Files processed: ${markdownFiles.length}`);
log(`   Files with issues: ${filesWithIssues}`);
log(`   Total errors: ${totalErrors}`);
log(`   Total warnings: ${totalWarnings}`);
log(`   Total issues: ${totalIssues}`);

// Add summary to report
addToReport('');
addToReport('═══════════════════════════════════════════════════════════════');
addToReport('                        SUMMARY');
addToReport('═══════════════════════════════════════════════════════════════');
addToReport('');
addToReport(`  📁 Files processed:    ${markdownFiles.length}`);
addToReport(`  📄 Files with issues:  ${filesWithIssues}`);
addToReport(`  ❌ Total errors:       ${totalErrors}`);
addToReport(`  ⚠️  Total warnings:     ${totalWarnings}`);
addToReport(`  📋 Total issues:       ${totalIssues}`);
addToReport('');

let exitStatus;
if (hasFatalErrors) {
    addToReport('Result: ❌ FAILED - Fatal errors found');
    exitStatus = 1;
} else if (totalIssues > 0) {
    addToReport('Result: ⚠️  PASSED WITH WARNINGS - No fatal errors');
    exitStatus = 0;
} else {
    addToReport('Result: ✅ PASSED - All files passed linting successfully!');
    exitStatus = 0;
}

addToReport('');
addToReport('═══════════════════════════════════════════════════════════════');

// Write report to file
const reportPath = path.join(targetDir, 'linter-report.txt');
try {
    fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
    log(`📝 Linter report written to: ${reportPath}`);
} catch (writeError) {
    log(`⚠️  Failed to write linter report: ${writeError.message}`, 'warn');
}

if (hasFatalErrors) {
    log('❌ Fatal errors found. Exiting with code 1.', 'error');
    process.exit(1);
} else if (totalIssues > 0) {
    log('⚠️  Warnings found but no fatal errors.', 'warn');
    process.exit(0);
} else {
    log('✅ All files passed linting successfully!', 'success');
    process.exit(0);
}
