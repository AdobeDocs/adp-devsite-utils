#!/usr/bin/env node

import path from 'path';
import fs from 'node:fs';

try {
  const { siteMetadata } = await import('./gatsby-config.js');

  let sideWideBanner = ``;
  if (siteMetadata.siteWideBanner) {
    sideWideBanner = JSON.stringify(siteMetadata.siteWideBanner);
  }

  let configFilePath = path.resolve(__dirname + '/src/pages/sitewidebanner.json');
  fs.writeFileSync(configFilePath, sideWideBanner);
  console.log(`Generated file: ${configFilePath}`);

} catch (err) {
  console.error(err);
}