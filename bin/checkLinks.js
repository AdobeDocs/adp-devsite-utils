#!/usr/bin/env node

import fetch from 'node-fetch';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = process.cwd();

// Cache for file content and headings to avoid re-reading files
const fileCache = new Map();
const headingCache = new Map();

function getMarkdownFiles(dir, results = []) {
  if (!fs.existsSync(dir)) return results;

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
    const controller = new AbortController();
    // Reduced timeout from 30s to 8s for much faster failure detection
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      // Add connection pooling headers
      headers: {
        'Connection': 'keep-alive'
      }
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    if (error.name === 'AbortError') {
      // Timeout occurred, try with GET method but with shorter timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'Connection': 'keep-alive'
          }
        });

        clearTimeout(timeoutId);
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

// Cache file content to avoid re-reading
function getCachedFileContent(filePath) {
  if (!fileCache.has(filePath)) {
    fileCache.set(filePath, fs.readFileSync(filePath, 'utf8'));
  }
  return fileCache.get(filePath);
}

// Cache headings to avoid re-parsing
function getCachedHeadings(filePath) {
  if (!headingCache.has(filePath)) {
    const content = getCachedFileContent(filePath);
    headingCache.set(filePath, getHeadings(content));
  }
  return headingCache.get(filePath);
}

async function checkLinks() {
  const markdownFiles = getMarkdownFiles('./src/pages');
  const linkRegex = /\[.*?\]\(([^)"'\s]+)(?:\s+"[^"]*")?\)/g;
  let brokenLinks = [];
  let externalLinksToCheck = new Map();

  // Process files in parallel for better performance
  const filePromises = markdownFiles.map(async (file) => {
    const content = getCachedFileContent(file);
    let match;
    const fileBrokenLinks = [];
    const fileExternalLinks = [];

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];

      // Skip empty links
      if (!url) continue;

      if (url.startsWith('http') || url.startsWith('https')) {
        fileExternalLinks.push({ url, file });
      } else if (!url.startsWith('mailto:')) {
        // Handle anchor links in local files
        const [filePath, anchor] = url.split('#');

        // Handle pure anchor links (links to sections in the same file)
        if (!filePath && anchor) {
          const headings = getCachedHeadings(file);
          if (!headings.has(anchor)) {
            fileBrokenLinks.push({
              file,
              url,
              type: 'anchor',
              error: `Heading "${anchor}" not found in file`
            });
          }
          continue;
        }

        // Check local files and their anchors
        const localPath = filePath.startsWith('/') ?
          path.join('.', filePath.slice(1)) :
          path.join(path.dirname(file), filePath);

        if (!fs.existsSync(localPath)) {
          fileBrokenLinks.push({
            file,
            url,
            type: 'local',
            error: 'File not found'
          });
        } else if (anchor) {
          // If file exists and there's an anchor, check if the heading exists
          const headings = getCachedHeadings(localPath);
          if (!headings.has(anchor)) {
            fileBrokenLinks.push({
              file,
              url,
              type: 'anchor',
              error: `Heading "${anchor}" not found in target file`
            });
          }
        }
      }
    }

    return { fileBrokenLinks, fileExternalLinks };
  });

  // Wait for all file processing to complete
  const fileResults = await Promise.all(filePromises);
  
  // Collect all results
  for (const { fileBrokenLinks, fileExternalLinks } of fileResults) {
    brokenLinks.push(...fileBrokenLinks);
    for (const { url, file } of fileExternalLinks) {
      externalLinksToCheck.set(url, file);
    }
  }

  // Second pass: check external links with improved concurrency
  if (externalLinksToCheck.size > 0) {
    console.log(`\nChecking ${externalLinksToCheck.size} external links...`);
    
    // Process external links in batches to avoid overwhelming servers
    const batchSize = 10;
    const externalLinksArray = Array.from(externalLinksToCheck.entries());
    const externalResults = [];

    for (let i = 0; i < externalLinksArray.length; i += batchSize) {
      const batch = externalLinksArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async ([url, file]) => {
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
      externalResults.push(...batchResults);
    }

    brokenLinks = [...brokenLinks, ...externalResults.filter(result => result !== null)];
  }

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
