#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import { spawn } from 'child_process';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

async function runLint() {
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

        try {
            // Run remark with timeout and progress indication
            const result = await runRemarkWithTimeout(markdownFiles.length);

            if (result.success) {
                log('✅ All markdown files passed linting!', 'success');
                console.log('\n✅ All markdown files passed linting!');
            } else {
                log('Linting completed with issues', 'warn');
            }

        } catch (lintError) {
            log(`Linting failed: ${lintError.message}`, 'error');
            console.error('\n❌ Linting failed:', lintError.message);
            process.exit(1);
        }

    } catch (err) {
        log(`Linting failed: ${err.message}`, 'error');
        console.error('Error while running lint:', err);
        process.exit(1);
    }
}

async function runRemarkWithTimeout(fileCount) {
    return new Promise((resolve, reject) => {
        // Set a reasonable timeout (5 minutes for large repos)
        const timeout = Math.max(60000, fileCount * 1000); // 1 second per file, minimum 1 minute

        console.log(`Setting timeout to ${Math.round(timeout/1000)} seconds...`);

        const remarkProcess = spawn('npx', ['remark', '.', '--quiet', '--frail'], {
            cwd: __dirname,
            stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        remarkProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        remarkProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
            remarkProcess.kill('SIGTERM');
            reject(new Error(`Linting timed out after ${Math.round(timeout/1000)} seconds. Try running with fewer files or increase timeout.`));
        }, timeout);

        remarkProcess.on('close', (code) => {
            clearTimeout(timeoutId);

            if (code === 0) {
                resolve({ success: true, stdout, stderr });
            } else {
                // Re-run without --quiet to show the actual issues
                console.log('\nShowing detailed linting issues...');
                showDetailedIssues();
                resolve({ success: false, stdout, stderr });
            }
        });

        remarkProcess.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to start remark: ${error.message}`));
        });
    });
}

async function showDetailedIssues() {
    return new Promise((resolve) => {
        const remarkProcess = spawn('npx', ['remark', '.', '--frail'], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        remarkProcess.on('close', (code) => {
            resolve();
        });
    });
}

// Call the main function
runLint().catch(error => {
    console.error('Error while running lint:', error);
    process.exit(1);
});
