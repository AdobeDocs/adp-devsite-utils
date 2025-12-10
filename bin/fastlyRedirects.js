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
const removeMode = args.includes('--remove') || args.includes('-r'); // Remove mode flag

// Filter out flags to get positional arguments
const positionalArgs = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
const environment = positionalArgs[0] || 'stage'; // Default to stage if no argument provided

if (!['stage', 'prod'].includes(environment)) {
  log('Error: Environment must be "stage" or "prod"', 'error');
  log('Usage: node fastlyRedirects.js [stage|prod] [--dry-run] [--verbose] [--remove]', 'error');
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
if (removeMode) {
  log('REMOVE MODE - Redirects will be deleted from Fastly dictionary', 'warn');
}
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
      redirects[redirect.Source] = redirect.Destination;
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
    throw new Error('Redirects must be an object with Source URLs as keys and Destination URLs as values');
  }

  // Validate redirect structure - keys are Sources, values are Destinations
  for (const [Source, Destination] of Object.entries(redirects)) {
    if (typeof Source !== 'string' || typeof Destination !== 'string') {
      throw new Error('Each redirect must have string Source and Destination values');
    }
    if (!Source || !Destination) {
      throw new Error('Source and Destination cannot be empty strings');
    }
  }
}

async function updateDictionary(redirects) {
  try {
    logSection('UPDATE DICTIONARY');
    logStep(`Adding redirects to dictionary`);

    if (dryRun) {
      log('DRY RUN: Would add the following redirects to Fastly dictionary:', 'warn');
      for (const [Source, Destination] of Object.entries(redirects)) {
        log(`  DRY RUN: ${Source} -> ${Destination}`, 'warn');
      }
      log(`DRY RUN: Would make ${Object.keys(redirects).length} API calls to Fastly`, 'warn');
      log('DRY RUN: Dictionary update completed (simulated)', 'warn');
      return;
    }

    // Add new redirects
    for (const [Source, Destination] of Object.entries(redirects)) {
      const url = `https://api.fastly.com/service/${config.serviceId}/dictionary/${config.dictionaryId}/item`;
      const payload = `item_key=${Source}&item_value=${Destination}`;

      verbose(`Making POST request to: ${url}`);
      verbose(`Headers: Fastly-Key: ${fastlyKey.substring(0, 8)}...${fastlyKey.substring(fastlyKey.length - 4)}, Content-Type: application/x-www-form-urlencoded`);
      verbose(`Payload: ${payload}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Fastly-Key': fastlyKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `item_key=${Source}&item_value=${Destination}`
      });

      verbose(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        verbose(`Warning: Could not add redirect ${Source} -> ${Destination} (status: ${response.status})`, 'warn');
      } else {
        verbose(`Added redirect: ${Source} -> ${Destination}`);
      }
    }

    log('Dictionary updated successfully');
  } catch (error) {
    log(`Failed to update dictionary: ${error.message}`, 'error');
    throw error;
  }
}

async function removeDictionary(redirects) {
  try {
    logSection('REMOVE FROM DICTIONARY');
    logStep(`Removing redirects from dictionary`);

    if (dryRun) {
      log('DRY RUN: Would remove the following redirects from Fastly dictionary:', 'warn');
      for (const [Source, Destination] of Object.entries(redirects)) {
        log(`  DRY RUN: Remove ${Source} (currently points to ${Destination})`, 'warn');
      }
      log(`DRY RUN: Would make ${Object.keys(redirects).length} API calls to Fastly`, 'warn');
      log('DRY RUN: Dictionary removal completed (simulated)', 'warn');
      return;
    }

    // Remove redirects
    for (const [Source, Destination] of Object.entries(redirects)) {
      const url = `https://api.fastly.com/service/${config.serviceId}/dictionary/${config.dictionaryId}/item/${Source}`;

      verbose(`Making DELETE request to: ${url}`);
      verbose(`Headers: Fastly-Key: ${fastlyKey.substring(0, 8)}...${fastlyKey.substring(fastlyKey.length - 4)}`);

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Fastly-Key': fastlyKey
        }
      });

      verbose(`Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        verbose(`Warning: Could not remove redirect ${Source} (status: ${response.status})`, 'warn');
      } else {
        verbose(`Removed redirect: ${Source}`);
      }
    }

    log('Dictionary items removed successfully');
  } catch (error) {
    log(`Failed to remove from dictionary: ${error.message}`, 'error');
    throw error;
  }
}

async function main() {
  try {
    let redirects;

    logStep('Loading redirects from redirects file');
    redirects = await loadRedirectsFromFile();

    verbose(`Loaded ${Object.keys(redirects).length} redirects`);

    // Log all redirects that will be processed
    verbose('Redirects to be processed:');
    for (const [Source, Destination] of Object.entries(redirects)) {
      verbose(`  ${Source} -> ${Destination}`);
    }

    if (removeMode) {
      await removeDictionary(redirects);
    } else {
      await updateDictionary(redirects);
    }
  } catch (error) {
    log(`Fastly operation failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();