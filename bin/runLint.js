#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

try {
    logSection('RUN LINT');
    logStep('Starting markdown linting process');

    // Check if we're in a repo with markdown files
    const markdownFiles = await glob('**/*.md', {
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '**/node_modules/**']
    });

    if (markdownFiles.length === 0) {
        log('No markdown files found to lint', 'warn');
        console.log('No markdown files found in current directory or subdirectories.');
        return;
    }

    verbose(`Found ${markdownFiles.length} markdown files to lint`);

    // Check if .remarkrc.yaml exists
    const remarkConfigPath = path.join(__dirname, '.remarkrc.yaml');
    if (!fs.existsSync(remarkConfigPath)) {
        log('No .remarkrc.yaml found in current directory', 'error');
        console.error('❌ No .remarkrc.yaml configuration file found.');
        console.error('Please create a .remarkrc.yaml file with your linting rules.');
        process.exit(1);
    }

    logStep('Running remark linting');
    console.log(`\nLinting ${markdownFiles.length} markdown files...`);

    // Use npx to run remark with the local config
    const { execSync } = await import('child_process');
    
    try {
        // Run remark lint on all markdown files
        const result = execSync('npx remark . --quiet --frail', {
            cwd: __dirname,
            stdio: 'pipe',
            encoding: 'utf8'
        });
        
        // If we get here, no issues were found
        log('✅ All markdown files passed linting!', 'success');
        console.log('\n✅ All markdown files passed linting!');
        
    } catch (lintError) {
        // remark exits with non-zero code when issues are found
        if (lintError.status !== 0) {
            // Re-run without --quiet to show the actual issues
            try {
                execSync('npx remark . --frail', {
                    cwd: __dirname,
                    stdio: 'inherit'
                });
            } catch (showError) {
                // This will show the linting issues
                console.error('\n❌ Linting failed with the following issues:');
                process.exit(1);
            }
        } else {
            log('Linting completed with issues', 'warn');
        }
    }

} catch (err) {
    log(`Linting failed: ${err.message}`, 'error');
    console.error('Error while running lint:', err);
    process.exit(1);
}