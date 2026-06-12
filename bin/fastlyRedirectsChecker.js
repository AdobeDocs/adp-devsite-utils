#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join, resolve, isAbsolute } from 'path';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HOSTNAME_RE = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

function resolveRedirectsPath(filePath) {
  return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}

function parseRedirectsFileArg(args, index) {
  const filePath = args[index].includes('=')
    ? args[index].slice(args[index].indexOf('=') + 1)
    : args[index + 1];

  if (!filePath) {
    log(`Error: ${args[index]} requires a file path`, 'error');
    printUsage();
    process.exit(1);
  }

  return {
    redirectsFile: resolveRedirectsPath(filePath),
    consumed: args[index].includes('=') ? 0 : 1,
  };
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let host = null;
  let redirectsFile = join(process.cwd(), 'redirects.json');
  let redirectsFileSet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--host' && args[i + 1]) {
      host = args[++i];
    } else if (arg.startsWith('--host=')) {
      host = arg.slice('--host='.length);
    } else if (
      arg === '--file' ||
      arg === '--redirects' ||
      arg === '-f' ||
      arg.startsWith('--file=') ||
      arg.startsWith('--redirects=')
    ) {
      const { redirectsFile: parsedPath, consumed } = parseRedirectsFileArg(args, i);
      redirectsFile = parsedPath;
      redirectsFileSet = true;
      i += consumed;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      log(`Error: Unknown option "${arg}"`, 'error');
      printUsage();
      process.exit(1);
    } else if (!redirectsFileSet) {
      redirectsFile = resolveRedirectsPath(arg);
      redirectsFileSet = true;
    } else {
      log(`Error: Unexpected argument "${arg}"`, 'error');
      printUsage();
      process.exit(1);
    }
  }

  return { host, redirectsFile };
}

function printUsage() {
  log('Usage: node fastlyRedirectsChecker.js --host <hostname> [--file redirects.json] [--verbose]', 'error');
  log('       node fastlyRedirectsChecker.js [redirects.json] --host <hostname> [--verbose]', 'error');
  log('', 'error');
  log('Options:', 'error');
  log('  --host <hostname>      Host to test redirects against (required)', 'error');
  log('  --file, --redirects, -f <path>  Path to redirects file (default: ./redirects.json)', 'error');
  log('  --verbose, -v          Enable verbose logging', 'error');
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

function loadRedirectsFromFile(redirectsFilePath) {
  verbose(`Loading redirects from file: ${redirectsFilePath}`);

  if (!existsSync(redirectsFilePath)) {
    throw new Error(`Redirects file not found: ${redirectsFilePath}`);
  }

  const redirectsData = JSON.parse(readFileSync(redirectsFilePath, 'utf8'));

  if (!redirectsData.data || !Array.isArray(redirectsData.data)) {
    throw new Error('Invalid redirects.json format. Expected { data: [...] }');
  }

  for (const redirect of redirectsData.data) {
    if (typeof redirect.Source !== 'string' || typeof redirect.Destination !== 'string') {
      throw new Error('Each redirect must have string Source and Destination values');
    }
    if (!redirect.Source || !redirect.Destination) {
      throw new Error('Source and Destination cannot be empty strings');
    }
  }

  verbose(`Loaded ${redirectsData.data.length} redirects`);
  return redirectsData.data;
}

function buildUrl(host, path) {
  return new URL(path, `https://${host}/`).href;
}

async function checkRedirect(host, source, expectedDestination) {
  const url = buildUrl(host, source);
  const expectedFullUrl = buildUrl(host, expectedDestination);

  try {
    verbose(`Testing: ${url}`);
    verbose(`  Expected destination: ${expectedFullUrl}`);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FastlyRedirectsChecker/1.0)',
      },
    });

    const status = response.status;
    const location = response.headers.get('location');
    const actualUrl = location ? new URL(location, url).href : null;
    const isRedirectStatus = REDIRECT_STATUSES.has(status);
    const destinationMatches = actualUrl === expectedFullUrl;
    const success = isRedirectStatus && destinationMatches;

    verbose(`  Status: ${status}`);
    verbose(`  Location: ${location ?? '(none)'}`);
    if (actualUrl) {
      verbose(`  Resolved URL: ${actualUrl}`);
    }

    return {
      source,
      expectedDestination,
      expectedFullUrl,
      url,
      status,
      location,
      actualUrl,
      destinationMatches,
      success,
    };
  } catch (error) {
    verbose(`  Error: ${error.message}`);
    return {
      source,
      expectedDestination,
      expectedFullUrl,
      url,
      status: null,
      location: null,
      actualUrl: null,
      destinationMatches: false,
      success: false,
      error: error.message,
    };
  }
}

async function main() {
  const { host, redirectsFile } = parseArgs(process.argv);
  validateHost(host);

  logSection('FASTLY REDIRECTS CHECKER');
  logStep(`Testing redirects on ${host}`);
  log(`Redirects file: ${redirectsFile}`);

  try {
    const redirects = loadRedirectsFromFile(redirectsFile);

    if (redirects.length === 0) {
      log('No redirects found in redirects.json', 'warn');
      return;
    }

    logStep(`Testing ${redirects.length} redirects...`);
    console.log('');

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < redirects.length; i++) {
      const { Source, Destination } = redirects[i];
      const result = await checkRedirect(host, Source, Destination);
      results.push(result);

      if (result.success) {
        successCount++;
        log(`✓ [${i + 1}/${redirects.length}] ${result.source} → ${result.status}`, 'info');
      } else {
        failureCount++;
        if (result.error) {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ERROR: ${result.error}`, 'error');
        } else if (!REDIRECT_STATUSES.has(result.status)) {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ${result.status} (expected redirect)`, 'error');
        } else if (!result.destinationMatches) {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ${result.status} (wrong destination)`, 'error');
        } else {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ${result.status}`, 'error');
        }
      }

      if (i < redirects.length - 1) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
      }
    }

    console.log('');
    logSection('SUMMARY');
    log(`Host: ${host}`);
    log(`Total redirects tested: ${redirects.length}`);
    log(`✓ Successful: ${successCount}`, successCount === redirects.length ? 'info' : 'warn');
    log(`✗ Failed: ${failureCount}`, failureCount > 0 ? 'error' : 'info');

    if (failureCount > 0) {
      console.log('');
      logSection('FAILED REDIRECTS');
      results
        .filter((result) => !result.success)
        .forEach((result) => {
          log(`Source: ${result.source}`, 'error');
          log(`  Expected destination: ${result.expectedDestination}`, 'error');
          log(`  Expected full URL: ${result.expectedFullUrl}`, 'error');
          log(`  URL tested: ${result.url}`, 'error');
          if (result.error) {
            log(`  Error: ${result.error}`, 'error');
          } else {
            log(`  Status: ${result.status}`, 'error');
            log(`  Location: ${result.location ?? '(none)'}`, 'error');
            if (result.actualUrl) {
              log(`  Resolved URL: ${result.actualUrl}`, 'error');
            }
            if (!result.destinationMatches) {
              log('  Destination does not match expected', 'error');
            }
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
