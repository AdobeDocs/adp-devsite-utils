#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory where this script is located (adp-devsite-utils repo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adpDevsiteUtilsDir = path.dirname(__dirname);

console.log('Running remark with remark-heading-id plugin from adp-devsite-utils...');

// Run remark from the adp-devsite-utils directory (where plugins are installed)
// but process files from the target repo
const remarkProcess = spawn('npx', [
    'remark',
    path.join(process.cwd(), 'src', 'pages'),
    '--quiet',
    '--frail',
    '--use', 'remark-heading-id'
], {
    cwd: adpDevsiteUtilsDir, // Run from adp-devsite-utils repo
    stdio: 'inherit'
});

remarkProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ All markdown files passed linting!');
    } else {
        console.log('\n❌ Linting completed with issues');
        process.exit(1);
    }
});

remarkProcess.on('error', (error) => {
    console.error('Error running remark:', error);
    process.exit(1);
});
