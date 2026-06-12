#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
const SOURCE_HOST = 'developer.adobe.com';
const DEFAULT_XML_FILE = 'indesign-dom-paths.xml';
const LOC_PATTERN = /<loc>([^<]+)<\/loc>/g;

function resolveFilePath(filePath) {
  return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}

function parseFileArg(args, index) {
  const filePath = args[index].includes('=')
    ? args[index].slice(args[index].indexOf('=') + 1)
    : args[index + 1];

  if (!filePath) {
    log(`Error: ${args[index]} requires a file path`, 'error');
    printUsage();
    process.exit(1);
  }

  return {
    xmlFile: resolveFilePath(filePath),
    consumed: args[index].includes('=') ? 0 : 1,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let host = null;
  let xmlFile = join(process.cwd(), DEFAULT_XML_FILE);
  let xmlFileSet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--host' && args[i + 1]) {
      host = args[++i];
    } else if (arg.startsWith('--host=')) {
      host = arg.slice('--host='.length);
    } else if (
      arg === '--file' ||
      arg === '-f' ||
      arg.startsWith('--file=')
    ) {
      const { xmlFile: parsedPath, consumed } = parseFileArg(args, i);
      xmlFile = parsedPath;
      xmlFileSet = true;
      i += consumed;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      log(`Error: Unknown option "${arg}"`, 'error');
      printUsage();
      process.exit(1);
    } else if (!xmlFileSet) {
      xmlFile = resolveFilePath(arg);
      xmlFileSet = true;
    } else {
      log(`Error: Unexpected argument "${arg}"`, 'error');
      printUsage();
      process.exit(1);
    }
  }

  return { host, xmlFile };
}

function printUsage() {
  log(`Usage: node fastlyRedirectsChecker.js --host <hostname> [--file ${DEFAULT_XML_FILE}] [--verbose]`, 'error');
  log(`       node fastlyRedirectsChecker.js [${DEFAULT_XML_FILE}] --host <hostname> [--verbose]`, 'error');
  log('', 'error');
  log('Options:', 'error');
  log('  --host <hostname>   Host to test URLs against (required)', 'error');
  log(`  --file, -f <path>   Path to sitemap XML (default: ./${DEFAULT_XML_FILE})`, 'error');
  log('  --verbose, -v       Enable verbose logging', 'error');
}

function validateHost(host) {
  if (!host) {
    log('Error: --host is required', 'error');
    printUsage();
    process.exit(1);
  }

  if (!HOSTNAME_RE.test(host)) {
    log(`Error: Invalid hostname "${host}"`, 'error');
    process.exit(1);
  }
}

function swapHost(urlString, host) {
  const url = new URL(urlString.trim());

  if (url.hostname !== SOURCE_HOST) {
    throw new Error(`Expected ${SOURCE_HOST} in loc URL, found ${url.hostname}: ${urlString}`);
  }

  url.hostname = host;
  return url.href;
}

function loadUrlsFromXml(xmlFilePath, host) {
  verbose(`Loading URLs from file: ${xmlFilePath}`);

  if (!existsSync(xmlFilePath)) {
    throw new Error(`XML file not found: ${xmlFilePath}`);
  }

  const xmlContent = readFileSync(xmlFilePath, 'utf8');
  const matches = [...xmlContent.matchAll(LOC_PATTERN)];

  if (matches.length === 0) {
    throw new Error('No <loc> entries found in XML file');
  }

  const urls = matches.map((match, index) => {
    const originalLoc = match[1].trim();
    let url;

    try {
      url = swapHost(originalLoc, host);
    } catch (error) {
      throw new Error(`Invalid <loc> at entry ${index + 1}: ${error.message}`);
    }

    return {
      originalLoc,
      url,
    };
  });

  verbose(`Loaded ${urls.length} URLs`);
  return urls;
}

async function checkUrlRedirects(url) {
  try {
    verbose(`Testing: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FastlyRedirectsChecker/1.0)',
      },
    });

    const status = response.status;
    const location = response.headers.get('location');
    const redirectUrl = location ? new URL(location, url).href : null;
    const success = REDIRECT_STATUSES.has(status);

    verbose(`  Status: ${status}`);
    verbose(`  Location: ${location ?? '(none)'}`);
    if (redirectUrl) {
      verbose(`  Redirect URL: ${redirectUrl}`);
    }

    return {
      url,
      status,
      location,
      redirectUrl,
      success,
    };
  } catch (error) {
    verbose(`  Error: ${error.message}`);
    return {
      url,
      status: null,
      location: null,
      redirectUrl: null,
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  const { host, xmlFile } = parseArgs(process.argv);
  validateHost(host);

  logSection('FASTLY REDIRECTS CHECKER');
  logStep(`Testing URLs on ${host}`);
  log(`XML file: ${xmlFile}`);
  log(`Replacing ${SOURCE_HOST} with ${host}`);

  try {
    const urls = loadUrlsFromXml(xmlFile, host);

    logStep(`Testing ${urls.length} URLs...`);
    console.log('');

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const { url, originalLoc } = urls[i];
      const result = await checkUrlRedirects(url);
      results.push({ ...result, originalLoc });
      const label = url.replace(`https://${host}`, '') || '/';

      if (result.success) {
        successCount++;
        log(`✓ [${i + 1}/${urls.length}] ${label} → ${result.status}`, 'info');
      } else {
        failureCount++;
        if (result.error) {
          log(`✗ [${i + 1}/${urls.length}] ${label} → ERROR: ${result.error}`, 'error');
        } else {
          log(`✗ [${i + 1}/${urls.length}] ${label} → ${result.status} (expected redirect)`, 'error');
        }
      }

      if (i < urls.length - 1) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      }
    }

    console.log('');
    logSection('SUMMARY');
    log(`Host: ${host}`);
    log(`Total URLs tested: ${urls.length}`);
    log(`✓ Redirects: ${successCount}`, successCount === urls.length ? 'info' : 'warn');
    log(`✗ No redirect / failed: ${failureCount}`, failureCount > 0 ? 'error' : 'info');

    if (failureCount > 0) {
      console.log('');
      logSection('FAILED URLS');
      results
        .filter((result) => !result.success)
        .forEach((result) => {
          log(`Original loc: ${result.originalLoc}`, 'error');
          log(`  URL tested: ${result.url}`, 'error');
          if (result.error) {
            log(`  Error: ${result.error}`, 'error');
          } else {
            log(`  Status: ${result.status}`, 'error');
            log(`  Location: ${result.location ?? '(none)'}`, 'error');
          }
          console.log('');
        });

      process.exit(1);
    }
  } catch (error) {
    log(`Fastly redirect checking failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
