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
const environment = args[0] || 'stage'; // Default to stage if no argument provided
const action = args[1] || 'get-version'; // Default action
const redirectsData = args[2]; // Optional redirects data as JSON string
const dryRun = args.includes('--dry-run') || args.includes('-d'); // Dry run flag

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

async function getActiveVersion() {
  try {
    logSection('GET ACTIVE VERSION');
    logStep(`Getting active version for ${environment} environment`);

    if (dryRun) {
      log('DRY RUN: Would fetch active version from Fastly API', 'warn');
      log('DRY RUN: Assuming active version is 123', 'warn');
      return 123; // Mock version for dry run
    }

    const url = `https://api.fastly.com/service/${config.serviceId}/version`;
    verbose(`Making GET request to: ${url}`);
    verbose(`Headers: Fastly-Key: ${fastlyKey.substring(0, 8)}...${fastlyKey.substring(fastlyKey.length - 4)}`);

    const response = await fetch(url, {
      headers: {
        'Fastly-Key': fastlyKey
      }
    });

    verbose(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const versions = await response.json();
    verbose(`Received ${versions.length} versions from Fastly API`);
    const activeVersion = versions.find(v => v.active === true);

    if (activeVersion) {
      log(`Active version: ${activeVersion.number}`);
      return activeVersion.number;
    } else {
      throw new Error('No active version found');
    }
  } catch (error) {
    log(`Failed to get active version: ${error.message}`, 'error');
    throw error;
  }
}

async function loadRedirectsFromStdin() {
  try {
    let data = '';
    process.stdin.setEncoding('utf8');

    return new Promise((resolve, reject) => {
      process.stdin.on('data', (chunk) => {
        data += chunk;
      });

      process.stdin.on('end', () => {
        try {
          const redirects = JSON.parse(data.trim());
          validateRedirects(redirects);
          resolve(redirects);
        } catch (error) {
          reject(new Error(`Failed to parse JSON from stdin: ${error.message}`));
        }
      });

      process.stdin.on('error', (error) => {
        reject(new Error(`Error reading from stdin: ${error.message}`));
      });
    });
  } catch (error) {
    log(`Failed to load redirects from stdin: ${error.message}`, 'error');
    throw error;
  }
}


function loadRedirectsFromData(jsonString) {
  try {
    const redirects = JSON.parse(jsonString);
    validateRedirects(redirects);
    return redirects;
  } catch (error) {
    log(`Failed to parse redirects data: ${error.message}`, 'error');
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

async function updateDictionary(versionId, redirects) {
  try {
    logSection('UPDATE DICTIONARY');
    logStep(`Adding redirects to dictionary for version ${versionId}`);

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
      const url = `https://api.fastly.com/service/${config.serviceId}/version/${versionId}/dictionary/${config.dictionaryId}/items`;
      const payload = {
        item_key: source,
        item_value: destination
      };

      verbose(`Making POST request to: ${url}`);
      verbose(`Headers: Fastly-Key: ${fastlyKey.substring(0, 8)}...${fastlyKey.substring(fastlyKey.length - 4)}, Content-Type: application/json`);
      verbose(`Payload: ${JSON.stringify(payload)}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Fastly-Key': fastlyKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
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
      case 'get-version':
        await getActiveVersion();
        break;
      case 'update-redirects':
        if (!redirectsData && process.stdin.isTTY) {
          log('Error: Redirects source required for update-redirects action', 'error');
          log('Usage: node fastlyRedirects.js [stage|prod] update-redirects \'{"source":"/old","destination":"/new"}\'', 'error');
          log('   or: echo \'{"source":"/old","destination":"/new"}\' | node fastlyRedirects.js [stage|prod] update-redirects', 'error');
          process.exit(1);
        }
        const version = await getActiveVersion();
        let redirects;

        if (redirectsData) {
          // Load from command line argument
          logStep('Loading redirects from command line argument');
          redirects = loadRedirectsFromData(redirectsData);
        } else {
          // Load from stdin
          logStep('Loading redirects from stdin');
          redirects = await loadRedirectsFromStdin();
        }

        verbose(`Loaded ${Object.keys(redirects).length} redirects`);

        await updateDictionary(version, redirects);
        break;
      default:
        log('Available actions: get-version, update-redirects');
        log('Usage: node fastlyRedirects.js [stage|prod] [action] [redirects-data] [--dry-run|-d]');
        log('Options:');
        log('  --dry-run, -d    Show what would be done without making API calls');
    }
  } catch (error) {
    log(`Fastly operation failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();