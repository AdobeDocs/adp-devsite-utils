#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

// Get the directory where this script is located (adp-devsite-utils repo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptDir = __dirname;

// Get the current working directory (target repo where the command is run)
const targetDir = process.cwd();

verbose(`Script directory: ${scriptDir}`);
verbose(`Target directory: ${targetDir}`);

async function runLint() {
    try {
        logSection('RUN LINT');
        logStep('Starting markdown linting process');

        // Check if package.json exists in target repo
        const packageJsonPath = path.join(targetDir, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            log('No package.json found in target directory', 'error');
            console.error('❌ No package.json found.');
            process.exit(1);
        }

        logStep('Running remark with minimal configuration to isolate git issue');
        console.log('\nRunning remark linting...');

        try {
            // First, try with just basic remark to see if the issue is with our custom plugins
            const result = await runRemarkWithMinimalConfig();

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

async function runRemarkWithMinimalConfig() {
    return new Promise((resolve, reject) => {
        // Set a reasonable timeout (5 minutes)
        const timeout = 300000; // 5 minutes

        console.log(`Setting timeout to ${Math.round(timeout/1000)} seconds...`);

        // Try with just basic remark first, no custom config
        console.log('Testing with basic remark configuration...');

        const remarkProcess = spawn('npx', [
            'remark',
            'src/pages',
            '--quiet',
            '--frail'
        ], {
            cwd: targetDir, // Run in target repo
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
            reject(new Error(`Linting timed out after ${Math.round(timeout/1000)} seconds.`));
        }, timeout);

        remarkProcess.on('close', (code) => {
            clearTimeout(timeoutId);

            if (code === 0) {
                console.log('✅ Basic remark worked! Now trying with full config...');
                // If basic remark worked, try with full config
                runRemarkWithFullConfig().then(resolve).catch(reject);
            } else {
                console.log('❌ Basic remark failed. This suggests the issue is with remark itself, not our config.');
                console.log('stdout:', stdout);
                console.log('stderr:', stderr);
                resolve({ success: false, stdout, stderr });
            }
        });

        remarkProcess.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to start remark: ${error.message}`));
        });
    });
}

async function runRemarkWithFullConfig() {
    return new Promise((resolve, reject) => {
        // Get the absolute path to the .remarkrc.yaml in adp-devsite-utils repo
        const configPath = path.resolve(scriptDir, '..', '.remarkrc.yaml');

        if (!fs.existsSync(configPath)) {
            reject(new Error(`Could not find .remarkrc.yaml at ${configPath}`));
            return;
        }

        console.log(`Using config file: ${configPath}`);

        const remarkProcess = spawn('npx', [
            'remark',
            'src/pages',
            '--quiet',
            '--frail',
            '--config', configPath
        ], {
            cwd: targetDir, // Run in target repo
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

        remarkProcess.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, stdout, stderr });
            } else {
                // Re-run without --quiet to show the actual issues
                console.log('\nShowing detailed linting issues...');
                showDetailedIssues(configPath);
                resolve({ success: false, stdout, stderr });
            }
        });

        remarkProcess.on('error', (error) => {
            reject(new Error(`Failed to start remark: ${error.message}`));
        });
    });
}

async function showDetailedIssues(configPath) {
    return new Promise((resolve) => {
        const remarkProcess = spawn('npx', [
            'remark',
            'src/pages',
            '--frail',
            '--config', configPath
        ], {
            cwd: targetDir,
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
