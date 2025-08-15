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

// Embedded remark configuration
const EMBEDDED_CONFIG = {
    plugins: [
        'remark-heading-id'
        // Add more plugins here as needed, but avoid git-dependent ones like remark-validate-links
    ]
};

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

        logStep('Running remark with embedded configuration');
        console.log('\nRunning remark linting...');

        try {
            // Run remark with the embedded config
            const result = await runRemarkWithEmbeddedConfig();

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

async function runRemarkWithEmbeddedConfig() {
    return new Promise(async (resolve, reject) => {
        try {
            // Set a reasonable timeout (5 minutes)
            const timeout = 300000; // 5 minutes

            console.log(`Setting timeout to ${Math.round(timeout/1000)} seconds...`);

            // Create a temporary config file from the embedded config
            const tempConfigPath = createTempConfigFromEmbedded();

            if (!tempConfigPath) {
                reject(new Error('Failed to create temporary config file'));
                return;
            }

            console.log(`Using embedded configuration`);

            // Run remark with the temporary config
            const remarkProcess = spawn('npx', [
                'remark',
                'src/pages',
                '--quiet',
                '--frail',
                '--config', tempConfigPath
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
                // Clean up temp file
                try { fs.unlinkSync(tempConfigPath); } catch (e) {}
                reject(new Error(`Linting timed out after ${Math.round(timeout/1000)} seconds.`));
            }, timeout);

            remarkProcess.on('close', (code) => {
                clearTimeout(timeoutId);

                // Clean up temp file
                try { fs.unlinkSync(tempConfigPath); } catch (e) {}

                if (code === 0) {
                    resolve({ success: true, stdout, stderr });
                } else {
                    // Re-run without --quiet to show the actual issues
                    console.log('\nShowing detailed linting issues...');
                    showDetailedIssues(tempConfigPath);
                    resolve({ success: false, stdout, stderr });
                }
            });

            remarkProcess.on('error', (error) => {
                clearTimeout(timeoutId);
                // Clean up temp file
                try { fs.unlinkSync(tempConfigPath); } catch (e) {}
                reject(new Error(`Failed to start remark: ${error.message}`));
            });

        } catch (error) {
            reject(new Error(`Failed to setup config: ${error.message}`));
        }
    });
}

function createTempConfigFromEmbedded() {
    try {
        // Convert the embedded config object to YAML format
        const configYaml = convertConfigToYaml(EMBEDDED_CONFIG);

        // Create temporary config file in target repo
        const tempConfigPath = path.join(targetDir, '.remarkrc.temp.yaml');
        fs.writeFileSync(tempConfigPath, configYaml);

        console.log(`Created temp config at: ${tempConfigPath}`);

        // Verify the file was created
        if (!fs.existsSync(tempConfigPath)) {
            console.error(`Failed to create temp config file at ${tempConfigPath}`);
            return null;
        }

        return tempConfigPath;

    } catch (error) {
        console.error('Error creating temp config:', error);
        return null;
    }
}

function convertConfigToYaml(config) {
    // Simple YAML conversion for the embedded config
    let yaml = 'plugins:\n';

    for (const plugin of config.plugins) {
        yaml += `  - ${plugin}\n`;
    }

    return yaml;
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
