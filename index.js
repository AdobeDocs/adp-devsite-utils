#!/usr/bin/env node

import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get available scripts from bin folder
function getAvailableScripts() {
  const binPath = join(__dirname, 'bin');
  const files = fs.readdirSync(binPath);
  return files
    .filter(file => file.endsWith('.js') && file !== 'scriptUtils.js')
    .map(file => file.replace('.js', ''));
}

// Execute a script from the bin folder
function executeScript(scriptName, args = []) {
  const scriptPath = join(__dirname, 'bin', `${scriptName}.js`);
  
  if (!fs.existsSync(scriptPath)) {
    console.error(`Script '${scriptName}' not found.`);
    console.log('Available scripts:', getAvailableScripts().join(', '));
    process.exit(1);
  }

  const child = spawn('node', [scriptPath, ...args], {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  child.on('error', (error) => {
    console.error(`Failed to execute script: ${error.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code);
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node index.js <script-name> [script-args...]');
    console.log('');
    console.log('Available scripts:');
    const scripts = getAvailableScripts();
    scripts.forEach(script => {
      console.log(`  ${script}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  node index.js buildSiteWideBanner');
    console.log('  node index.js buildNavigation');
    console.log('  node index.js checkLinks');
    process.exit(0);
  }

  const scriptName = args[0];
  const scriptArgs = args.slice(1);
  
  executeScript(scriptName, scriptArgs);
}

// Run the main function
main();

