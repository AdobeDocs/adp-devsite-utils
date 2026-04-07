#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

const SITE_METADATA_FILE_PATH = path.join('src', 'pages', 'adp-site-metadata.json');

try {
  logSection('BUILD SITE METADATA');
  logStep('Starting site metadata build process');

  const siteMetadataEntries = [
    { key: 'contributors', file: 'src/pages/contributors.json' },
    { key: 'get-credentials', file: 'src/pages/credential/getcredential.json' },
    { key: 'site-wide-banner', file: 'src/pages/site-wide-banner.json' },
    { key: 'code-playground', file : 'src/pages/code-playground.json'},
    {key: 'discovery-interface', file: 'src/pages/discovery-interface.json'}
  ];

  const data = siteMetadataEntries.map(({ key, file }) => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    logStep(`Checking for ${file}`, exists ? 'found' : 'not found');
    return { key, value: exists ? file : null };
  });

  const siteMetadata = {
    total: data.length,
    offset: 0,
    limit: data.length,
    data,
    ':type': 'sheet'
  };

  verbose(`Writing site metadata file to: ${SITE_METADATA_FILE_PATH}`);
  const siteMetadataContent = JSON.stringify(siteMetadata);
  fs.writeFileSync(SITE_METADATA_FILE_PATH, siteMetadataContent);
  verbose(`Site metadata file written successfully (${siteMetadataContent.length} characters)`);
  console.log(`Generated file: ${SITE_METADATA_FILE_PATH}`);

} catch (err) {
  log(`Site metadata build failed: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
}
