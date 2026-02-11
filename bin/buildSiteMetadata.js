#!/usr/bin/env node

const { log, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();

try {
  logSection('BUILD SITE METADATA');
  logStep('Starting site metadata build process');
  log('Hello!');
} catch (err) {
  log(`Site metadata build failed: ${err.message}`, 'error');
  console.error(err);
}