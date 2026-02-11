#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
const { log, verbose,logSection, logStep } = await import('./scriptUtils.js');

try {
  logSection('BUILD SITE METADATA');
  logStep('Starting site metadata build process');

  const __dirname = process.cwd();
  verbose(`Current directory: ${__dirname}`);

  const melissaFilePath = path.join(__dirname + '/src/pages/melissa.md');
  const melissaFileExists = fs.existsSync(melissaFilePath);
  const configFilePath = path.join(__dirname + '/src/pages/config.md');
  const configFileExists = fs.existsSync(configFilePath);

  logStep('Checking for melissa.md', melissaFileExists ? 'found' : 'not found');
  logStep('Checking for config.md', configFileExists ? 'found' : 'not found');

  const siteMetadata = {
    melissaFileExists,
    configFileExists
  };

  const siteMetadataFilePath = path.join(__dirname + '/src/pages/adp-site-metadata.json');
  verbose(`Writing site metadata file to: ${siteMetadataFilePath}`);
  fs.writeFileSync(siteMetadataFilePath, JSON.stringify(siteMetadata));
  verbose(`Site metadata file written successfully (${siteMetadata.length} characters)`);
  console.log(`Generated file: ${siteMetadataFilePath}`);

  








} catch (err) {
  log(`Site metadata build failed: ${err.message}`, 'error');
  console.error(err);
}