#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();

function getMarkdownFiles(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (let entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getMarkdownFiles(fullPath, results);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }

  return results;
}

async function checkExternalLink(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      timeout: 30000,
      redirect: 'follow'
    });
    return response.ok;
  } catch (error) {
    if (error.message.includes('timeout')) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          timeout: 30000,
          redirect: 'follow'
        });
        return response.ok;
      } catch (retryError) {
        return false;
      }
    }
    return false;
  }
}

function getHeadings(content) {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings = new Set();
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const headingId = match[1]
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    headings.add(headingId);
  }

  return headings;
}

async function checkLinks() {
  const markdownFiles = getMarkdownFiles('./src/pages');
  const linkRegex = /\[.*?\]\(([^)"'\s]+)(?:\s+"[^"]*")?\)/g;
  let brokenLinks = [];
  let externalLinksToCheck = new Map();

  // First pass: collect and check local links
  for (const file of markdownFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];

      if (!url) {
        continue;
      }

      if (url.startsWith('http') || url.startsWith('https')) {
        externalLinksToCheck.set(url, file);
      } else if (!url.startsWith('mailto:')) {
        const [filePath, anchor] = url.split('#');

        if (!filePath && anchor) {
          const headings = getHeadings(content);
          if (!headings.has(anchor)) {
            brokenLinks.push({
              file,
              url,
              type: 'anchor',
              error: `Heading "${anchor}" not found in file`
            });
          }
          continue;
        }

        const localPath = filePath.startsWith('/') ?
          path.join('.', filePath.slice(1)) :
          path.join(path.dirname(file), filePath);

        if (!fs.existsSync(localPath)) {
          brokenLinks.push({
            file,
            url,
            type: 'local',
            error: 'File not found'
          });
        } else if (anchor) {
          const targetContent = fs.readFileSync(localPath, 'utf8');
          const headings = getHeadings(targetContent);
          if (!headings.has(anchor)) {
            brokenLinks.push({
              file,
              url,
              type: 'anchor',
              error: `Heading "${anchor}" not found in target file`
            });
          }
        }
      }
    }
  }

  // Second pass: check external links
  const externalResults = await Promise.all(
    Array.from(externalLinksToCheck.entries()).map(async ([url, file]) => {
      const isValid = await checkExternalLink(url);
      if (!isValid) {
        return {
          url,
          type: 'external',
          error: 'Link appears to be dead',
          file
        };
      }
      return null;
    })
  );

  const brokenExternalLinks = externalResults.filter(result => result !== null);
  brokenLinks = [...brokenLinks, ...brokenExternalLinks];

  // Report results
  if (brokenLinks.length > 0) {
    console.error(`\n❌ Found ${brokenLinks.length} broken links:`);
    brokenLinks.forEach(({ file, url, type, error }) => {
      if (type === 'local') {
        console.error(`  Local link in ${file}:  "${url}" - ${error}`);
      } else if (type === 'anchor') {
        console.error(`  Anchor link in ${file}:  "${url}" - ${error}`);
      } else {
        console.error(`  External link in ${file}:  "${url}" - ${error}`);
      }
    });
    process.exit(1);
  } else {
    console.log('\n✅ All links are valid.');
  }
}

checkLinks().catch(error => {
  console.error('Error while checking links:', error);
  process.exit(1);
});
