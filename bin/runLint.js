#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Running remark with remark-heading-id plugin...');

// Run remark with just the remark-heading-id plugin
const remarkProcess = spawn('npx', [
    'remark',
    'src/pages',
    '--quiet',
    '--frail',
    '--use', 'remark-heading-id'
], {
    cwd: process.cwd(),
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
