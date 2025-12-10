#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { log, verbose, logSection, logStep } = await import(join(__dirname, 'scriptUtils.js'));

// Host configuration
const HOSTS = {
  stage: 'developer-stage.adobe.com',
  prod: 'developer.adobe.com'
};

// Parse command line arguments
const args = process.argv.slice(2);
const verboseFlag = args.includes('--verbose') || args.includes('-v');

// Filter out flags to get positional arguments
const positionalArgs = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
const environment = positionalArgs[0] || 'stage';

if (!['stage', 'prod'].includes(environment)) {
  log('Error: Environment must be "stage" or "prod"', 'error');
  log('Usage: node redirectChecker.js [stage|prod] [--verbose]', 'error');
  process.exit(1);
}

const host = HOSTS[environment];

logSection('REDIRECT CHECKER');
logStep(`Testing redirects on ${environment} environment (${host})`);

// Load redirects from file
function loadRedirectsFromFile() {
  try {
    const redirectsFilePath = join(process.cwd(), 'redirects.json');
    verbose(`Loading redirects from file: ${redirectsFilePath}`);
    
    if (!existsSync(redirectsFilePath)) {
      throw new Error(`Redirects file not found: ${redirectsFilePath}`);
    }
    
    const fileContent = readFileSync(redirectsFilePath, 'utf8');
    const redirectsData = JSON.parse(fileContent);
    
    if (!redirectsData.data || !Array.isArray(redirectsData.data)) {
      throw new Error('Invalid redirects.json format. Expected { data: [...] }');
    }
    
    verbose(`Loaded ${redirectsData.data.length} redirects`);
    return redirectsData.data;
  } catch (error) {
    log(`Failed to load redirects from file: ${error.message}`, 'error');
    throw error;
  }
}

// Check a single redirect
async function checkRedirect(source, expectedDestination) {
  const url = `https://${host}${source}`;
  const expectedFullUrl = `https://${host}${expectedDestination}`;
  
  try {
    verbose(`Testing: ${url}`);
    verbose(`  Expected Destination: ${expectedFullUrl}`);
    
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow', // Follow redirects automatically
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RedirectChecker/1.0)'
      }
    });
    
    const finalUrl = response.url;
    const status = response.status;
    
    verbose(`  Final URL: ${finalUrl}`);
    verbose(`  Status: ${status}`);
    
    // Check if status is 200 AND the final URL matches the expected destination
    const destinationMatches = finalUrl === expectedFullUrl;
    const isSuccess = status === 200 && destinationMatches;
    
    if (!destinationMatches) {
      verbose(`  ⚠ Destination mismatch!`, 'warn');
    }
    
    return {
      source,
      expectedDestination,
      expectedFullUrl,
      url,
      finalUrl,
      status,
      destinationMatches,
      success: isSuccess
    };
  } catch (error) {
    verbose(`  Error: ${error.message}`);
    return {
      source,
      expectedDestination,
      expectedFullUrl,
      url,
      finalUrl: null,
      status: null,
      destinationMatches: false,
      success: false,
      error: error.message
    };
  }
}

// Main function
async function main() {
  try {
    const redirects = loadRedirectsFromFile();
    
    if (redirects.length === 0) {
      log('No redirects found in redirects.json', 'warn');
      return;
    }
    
    logStep(`Testing ${redirects.length} redirects...`);
    console.log(''); // Empty line for readability
    
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Test each redirect
    for (let i = 0; i < redirects.length; i++) {
      const redirect = redirects[i];
      const result = await checkRedirect(redirect.Source, redirect.Destination);
      results.push(result);
      
      if (result.success) {
        successCount++;
        log(`✓ [${i + 1}/${redirects.length}] ${result.source} → ${result.status}`, 'info');
      } else {
        failureCount++;
        if (result.error) {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ERROR: ${result.error}`, 'error');
        } else if (!result.destinationMatches && result.status === 200) {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ${result.status} (wrong destination)`, 'error');
        } else {
          log(`✗ [${i + 1}/${redirects.length}] ${result.source} → ${result.status}`, 'error');
        }
      }
      
      // Add a small delay to avoid overwhelming the server
      if (i < redirects.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Summary
    console.log(''); // Empty line for readability
    logSection('SUMMARY');
    log(`Total redirects tested: ${redirects.length}`);
    log(`✓ Successful (200 + correct destination): ${successCount}`, successCount === redirects.length ? 'info' : 'warn');
    log(`✗ Failed: ${failureCount}`, failureCount > 0 ? 'error' : 'info');
    
    // Show failed redirects details
    if (failureCount > 0) {
      console.log(''); // Empty line for readability
      logSection('FAILED REDIRECTS');
      results
        .filter(r => !r.success)
        .forEach(result => {
          log(`Source: ${result.source}`, 'error');
          log(`  Expected Destination: ${result.expectedDestination}`, 'error');
          log(`  Expected Full URL: ${result.expectedFullUrl}`, 'error');
          log(`  URL Tested: ${result.url}`, 'error');
          if (result.error) {
            log(`  Error: ${result.error}`, 'error');
          } else {
            log(`  Final URL: ${result.finalUrl}`, 'error');
            log(`  Status: ${result.status}`, 'error');
            if (!result.destinationMatches) {
              log(`  ⚠ Destination does not match expected!`, 'error');
            }
          }
          console.log(''); // Empty line between failures
        });
    }
    
    // Exit with error code if there were failures
    if (failureCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    log(`Redirect checking failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();

