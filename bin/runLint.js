#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory where this script is located (adp-devsite-utils repo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adpDevsiteUtilsDir = path.dirname(__dirname);

// Array of plugins to use - easily add/remove plugins here
const PLUGINS = [
    'remark-lint-no-multiple-toplevel-headings',
    'remark-validate-links',
    'remark-gfm',
    'remark-lint-no-hidden-table-cell',
    path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-check-frontmatter.js')
    // 'remark-lint-no-dead-links',
    // 'remark-lint-no-empty-url'
];

console.log(`Running remark with ${PLUGINS.length} plugin(s): ${PLUGINS.join(', ')}...`);

// Build the command array with all plugins
const commandArgs = [
    'remark',
    path.join(process.cwd(), 'src', 'pages'),
    '--quiet',
    '--frail',
    '--no-config' // Prevent loading .remarkrc.yaml
];

// Add each plugin with --use flag
PLUGINS.forEach(plugin => {
    commandArgs.push('--use', plugin);
});

// Run remark with the specified plugins
const remarkProcess = spawn('npx', commandArgs, {
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
