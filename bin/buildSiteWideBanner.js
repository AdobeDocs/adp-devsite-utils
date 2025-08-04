#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

  logSection('BUILD SITE WIDE BANNER');
  logStep('Starting site-wide banner build process');

  const currentDir = process.cwd();
  verbose(`Current directory: ${currentDir}`);

  const filePath = path.join(currentDir, 'gatsby-config.js');
  verbose(`Loading gatsby-config.js from: ${filePath}`);

  const { siteMetadata } = await import(filePath);
  verbose(`Loaded siteMetadata with ${Object.keys(siteMetadata).length} properties`);

  let sideWideBanner = ``;
  if (siteMetadata.siteWideBanner) {
    verbose(`Found siteWideBanner configuration`);
    sideWideBanner = JSON.stringify(siteMetadata.siteWideBanner);
    verbose(`Banner JSON length: ${sideWideBanner.length} characters`);
  } else {
    verbose(`No siteWideBanner configuration found`);
  }

  let configFilePath = path.resolve(__dirname + '/src/pages/sitewidebanner.json');
  verbose(`Writing banner config to: ${configFilePath}`);
  fs.writeFileSync(configFilePath, sideWideBanner);
  verbose(`Banner config written successfully (${sideWideBanner.length} characters)`);
  console.log(`Generated file: ${configFilePath}`);

} catch (err) {
  log(`Site-wide banner build failed: ${err.message}`, 'error');
  console.error(err);
}