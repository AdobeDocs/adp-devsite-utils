#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

function getMarkdownFiles(dir, results = []) {
  if (!fs.existsSync(dir)) {
    verbose(`Directory does not exist: ${dir}`);
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  verbose(`Scanning directory: ${dir} (${entries.length} entries)`);

  for (let entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      verbose(`  Found directory: ${entry.name}`);
      getMarkdownFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      verbose(`  Found markdown file: ${entry.name}`);
      results.push(fullPath);
    }
  }

  return results;
}

async function checkExternalLink(url) {
  verbose(`Checking external link: ${url}`);
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 30000, // Increased to 30 second timeout
      redirect: 'follow'
    });
    // Consider both OK responses and redirects (status 200-399) as valid
    const isValid = response.ok;
    verbose(`  Result: ${isValid ? 'VALID' : 'INVALID'} (status: ${response.status})`);
    return isValid;
  } catch (error) {
    verbose(`  Error: ${error.message}`);
    // If it's a timeout error, try one more time with GET method
    if (error.message.includes('timeout')) {
      verbose(`  Retrying with GET method due to timeout`);
      try {
        const response = await fetch(url, {
          method: 'GET',
          timeout: 30000,
          redirect: 'follow'
        });
        const isValid = response.ok;
        verbose(`  Retry result: ${isValid ? 'VALID' : 'INVALID'} (status: ${response.status})`);
        return isValid;
      } catch (retryError) {
        verbose(`  Retry failed: ${retryError.message}`);
        return false;
      }
    }
    return false;
  }
}

// Function to extract headings from markdown content
function getHeadings(content) {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings = new Set();
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    // Convert heading to lowercase, replace spaces and special chars with hyphens
    const headingId = match[1]
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.add(headingId);
  }

  verbose(`  Found ${headings.size} headings in content`);
  return headings;
}

async function checkLinks() {
  logSection('CHECK LINKS');
  logStep('Starting link checking process');

  const markdownFiles = getMarkdownFiles('./src/pages');
  verbose(`Found ${markdownFiles.length} markdown files to check`);

  const linkRegex = /\[.*?\]\(([^)"'\s]+)(?:\s+"[^"]*")?\)/g;
  let brokenLinks = [];
  let externalLinksToCheck = new Map();
  let totalLinksFound = 0;

  logStep('First pass: collecting and checking local links');
  // First pass: collect all links and check local ones
  for (const file of markdownFiles) {
    verbose(`Processing file: ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    let match;
    let fileLinksFound = 0;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      fileLinksFound++;
      totalLinksFound++;

      // Skip empty links
      if (!url) {
        verbose(`  Skipping empty link`);
        continue;
      }

      verbose(`  Found link: ${url}`);

      if (url.startsWith('http') || url.startsWith('https')) {
        externalLinksToCheck.set(url, file);
        verbose(`    Marked as external link`);
      } else if (!url.startsWith('mailto:')) {
        // Handle anchor links in local files
        const [filePath, anchor] = url.split('#');

        // Handle pure anchor links (links to sections in the same file)
        if (!filePath && anchor) {
          verbose(`    Checking anchor link: #${anchor}`);
          const headings = getHeadings(content);
          if (!headings.has(anchor)) {
            verbose(`    BROKEN: Heading "${anchor}" not found in file`);
            brokenLinks.push({
              file,
              url,
              type: 'anchor',
              error: `Heading "${anchor}" not found in file`
            });
          } else {
            verbose(`    VALID: Anchor "${anchor}" found`);
          }
          continue;
        }

        // Check local files and their anchors
        const localPath = filePath.startsWith('/') ?
          path.join('.', filePath.slice(1)) :
          path.join(path.dirname(file), filePath);

        verbose(`    Checking local file: ${localPath}`);

        if (!fs.existsSync(localPath)) {
          verbose(`    BROKEN: File not found`);
          brokenLinks.push({
            file,
            url,
            type: 'local',
            error: 'File not found'
          });
        } else {
          verbose(`    VALID: File exists`);
          if (anchor) {
            verbose(`    Checking anchor: #${anchor}`);
            // If file exists and there's an anchor, check if the heading exists
            const targetContent = fs.readFileSync(localPath, 'utf8');
            const headings = getHeadings(targetContent);
            if (!headings.has(anchor)) {
              verbose(`    BROKEN: Heading "${anchor}" not found in target file`);
              brokenLinks.push({
                file,
                url,
                type: 'anchor',
                error: `Heading "${anchor}" not found in target file`
              });
            } else {
              verbose(`    VALID: Anchor "${anchor}" found in target file`);
            }
          }
        }
      } else {
        verbose(`    Skipping mailto link`);
      }
    }
    verbose(`  File ${file}: found ${fileLinksFound} links`);
  }

  verbose(`Total links found: ${totalLinksFound}`);
  verbose(`External links to check: ${externalLinksToCheck.size}`);

  // Second pass: check external links concurrently
  logStep('Second pass: checking external links');
  console.log(`\nChecking links...`);
  verbose(`Checking ${externalLinksToCheck.size} external links concurrently`);

  const externalResults = await Promise.all(
    Array.from(externalLinksToCheck.entries()).map(async ([url, file], index) => {
      verbose(`Checking external link ${index + 1}/${externalLinksToCheck.size}: ${url}`);
      const isValid = await checkExternalLink(url);
      if (!isValid) {
        verbose(`  BROKEN: External link failed validation`);
        return {
          url,
          type: 'external',
          error: 'Link appears to be dead',
          file
        };
      }
      verbose(`  VALID: External link passed validation`);
      return null;
    })
  );

  const brokenExternalLinks = externalResults.filter(result => result !== null);
  verbose(`External links broken: ${brokenExternalLinks.length}`);

  brokenLinks = [...brokenLinks, ...brokenExternalLinks];

  // Report results
  verbose(`Total broken links: ${brokenLinks.length}`);
  if (brokenLinks.length > 0) {
    log(`Found ${brokenLinks.length} broken links`, 'error');
    console.error('\n❌ Found broken links:');
    brokenLinks.forEach(({ file, url, type, error }, index) => {
      verbose(`Broken link ${index + 1}: ${type} - ${url} in ${file}`);
      if (type === 'local') {
        console.error(`  Warning - Local link in ${file}:  "${url}" - ${error}`);
      } else if (type === 'anchor') {
        console.error(`  Warning - Anchor link in ${file}:  "${url}" - ${error}`);
      } else {
        console.error(`  Warning - External link in ${file}:  "${url}" - ${error}`);
      }
    });
    process.exit(1);
  } else {
    verbose('All links are valid');
    console.log('\n✅ All links are valid.');
  }
}

checkLinks().catch(error => {
  log(`Link checking process failed: ${error.message}`, 'error');
  console.error('Error while checking links:', error);
  process.exit(1);
});
