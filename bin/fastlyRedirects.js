#!/usr/bin/env node

import 'dotenv/config';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

// Fastly configuration from environment variables
const FASTLY_CONFIG = {
  stage: {
    serviceId: process.env.FASTLY_DEVELOPER_STAGE_ADOBE_COM_SERVICE_ID,
    domain: 'developer-stage.adobe.com',
    dictionaryId: process.env.FASTLY_DEVELOPER_STAGE_ADOBE_COM_INT_TO_INT_TABLE_ID
  },
  prod: {
    serviceId: process.env.FASTLY_DEVELOPER_ADOBE_COM_SERVICE_ID,
    domain: 'developer.adobe.com',
    dictionaryId: process.env.FASTLY_DEVELOPER_ADOBE_COM_INT_TO_INT_TABLE_ID
  }
};

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d'); // Dry run flag
const verboseFlag = args.includes('--verbose') || args.includes('-v'); // Verbose flag

// Filter out flags to get positional arguments
const positionalArgs = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
const environment = positionalArgs[0] || 'stage'; // Default to stage if no argument provided
const action = positionalArgs[1] || 'update-redirects'; // Default action
const redirectsData = positionalArgs[2]; // Optional redirects data as JSON string

if (!['stage', 'prod'].includes(environment)) {
  log('Error: Environment must be "stage" or "prod"', 'error');
  log('Usage: node fastlyRedirects.js [stage|prod] [action]', 'error');
  process.exit(1);
}

const config = FASTLY_CONFIG[environment];
const fastlyKey = process.env.FASTLY_API_TOKEN;

// Validate required environment variables
if (!fastlyKey) {
  log('Error: FASTLY_API_TOKEN environment variable not set', 'error');
  process.exit(1);
}

if (!config.serviceId) {
  const envVarName = environment === 'stage'
    ? 'FASTLY_DEVELOPER_STAGE_ADOBE_COM_SERVICE_ID'
    : 'FASTLY_DEVELOPER_ADOBE_COM_SERVICE_ID';
  log(`Error: ${envVarName} environment variable not set`, 'error');
  process.exit(1);
}

if (!config.dictionaryId) {
  const envVarName = environment === 'stage'
    ? 'FASTLY_DEVELOPER_STAGE_ADOBE_COM_INT_TO_INT_TABLE_ID'
    : 'FASTLY_DEVELOPER_ADOBE_COM_INT_TO_INT_TABLE_ID';
  log(`Error: ${envVarName} environment variable not set`, 'error');
  process.exit(1);
}

logStep(`Using ${environment} environment`);
if (dryRun) {
  log('DRY RUN MODE - No actual API calls will be made', 'warn');
}
verbose(`Service ID: ${config.serviceId}`);
verbose(`Domain: ${config.domain}`);
verbose(`Dictionary ID: ${config.dictionaryId}`);


async function loadRedirectsFromFile() {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    const redirectsFilePath = path.join(process.cwd(), 'redirects.json');
    verbose(`Loading redirects from file: ${redirectsFilePath}`);
    
    if (!fs.existsSync(redirectsFilePath)) {
      throw new Error(`Redirects file not found: ${redirectsFilePath}`);
    }
    
    const fileContent = fs.readFileSync(redirectsFilePath, 'utf8');
    verbose(`Raw file content: ${fileContent.substring(0, 200)}...`);
    
    const redirectsData = JSON.parse(fileContent);
    
    // Convert from the file format to the expected format
    const redirects = {};
    redirectsData.data.forEach(redirect => {
      redirects[redirect.source] = redirect.destination;
    });
    
    verbose(`Parsed JSON contains ${Object.keys(redirects).length} redirects`);
    verbose(`Parsed JSON: ${redirects}`);
    validateRedirects(redirects);
    return redirects;
  } catch (error) {
    log(`Failed to load redirects from file: ${error.message}`, 'error');
    throw error;
  }
}

function validateRedirects(redirects) {
  if (typeof redirects !== 'object' || redirects === null) {
    throw new Error('Redirects must be a JSON object');
  }

  if (Array.isArray(redirects)) {
    throw new Error('Redirects must be an object with source URLs as keys and destination URLs as values');
  }

  // Validate redirect structure - keys are sources, values are destinations
  for (const [source, destination] of Object.entries(redirects)) {
    if (typeof source !== 'string' || typeof destination !== 'string') {
      throw new Error('Each redirect must have string source and destination values');
    }
    if (!source || !destination) {
      throw new Error('Source and destination cannot be empty strings');
    }
  }
}

async function updateDictionary(redirects) {
  try {
    logSection('UPDATE DICTIONARY');
    logStep(`Adding redirects to dictionary`);

    if (dryRun) {
      log('DRY RUN: Would add the following redirects to Fastly dictionary:', 'warn');
      for (const [source, destination] of Object.entries(redirects)) {
        log(`  DRY RUN: ${source} -> ${destination}`, 'warn');
      }
      log(`DRY RUN: Would make ${Object.keys(redirects).length} API calls to Fastly`, 'warn');
      log('DRY RUN: Dictionary update completed (simulated)', 'warn');
      return;
    }

    // Add new redirects
    for (const [source, destination] of Object.entries(redirects)) {
      const url = `https://api.fastly.com/service/${config.serviceId}/dictionary/${config.dictionaryId}/item`;
      const payload = `item_key=${source}&item_value=${destination}`;

      verbose(`Making POST request to: ${url}`);
      verbose(`Headers: Fastly-Key: ${fastlyKey.substring(0, 8)}...${fastlyKey.substring(fastlyKey.length - 4)}, Content-Type: application/x-www-form-urlencoded`);
      verbose(`Payload: ${payload}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Fastly-Key': fastlyKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `item_key=${source}&item_value=${destination}`
      });

      verbose(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        verbose(`Warning: Could not add redirect ${source} -> ${destination} (status: ${response.status})`, 'warn');
      } else {
        verbose(`Added redirect: ${source} -> ${destination}`);
      }
    }

    log('Dictionary updated successfully');
  } catch (error) {
    log(`Failed to update dictionary: ${error.message}`, 'error');
    throw error;
  }
}

async function main() {
  try {
    switch (action) {
      case 'update-redirects':
        let redirects;

        logStep('Loading redirects from redirects file');
        redirects = await loadRedirectsFromFile();

        verbose(`Loaded ${Object.keys(redirects).length} redirects`);

        // Log all redirects that will be processed
        verbose('Redirects to be processed:');
        for (const [source, destination] of Object.entries(redirects)) {
          verbose(`  ${source} -> ${destination}`);
        }

        await updateDictionary(redirects);
        break;
      default:
        log('Available actions: update-redirects');
        log('Usage: node fastlyRedirects.js [stage|prod] [action] [--dry-run|-d]');
        log('Options:');
        log('  --dry-run, -d    Show what would be done without making API calls');
        log('  --verbose, -v    Enable verbose logging');
    }
  } catch (error) {
    log(`Fastly operation failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();