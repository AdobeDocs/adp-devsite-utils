#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  const currentDir = process.cwd();
  const filePath = path.join(currentDir, 'gatsby-config.js');
  const { siteMetadata } = await import(filePath);

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