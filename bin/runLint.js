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

        logStep('Running remark with adp-devsite-utils configuration');
        console.log('\nRunning remark linting...');

        try {
            // Run remark directly with the adp-devsite-utils config
            const result = await runRemarkWithConfig();

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

async function runRemarkWithConfig() {
    return new Promise((resolve, reject) => {
        // Set a reasonable timeout (5 minutes)
        const timeout = 300000; // 5 minutes

        console.log(`Setting timeout to ${Math.round(timeout/1000)} seconds...`);

        try {
            // Create a temporary config file with absolute paths
            const tempConfigPath = createTempConfig();

            verbose(`Using temporary config file: ${tempConfigPath}`);
            console.log(`Using temporary config file: ${tempConfigPath}`);

            // Verify the temp file exists
            if (!fs.existsSync(tempConfigPath)) {
                throw new Error(`Failed to create temporary config file at ${tempConfigPath}`);
            }

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
            reject(new Error(`Failed to create config: ${error.message}`));
        }
    });
}

function createTempConfig() {
    try {
        // Read the original config
        const originalConfigPath = path.join(scriptDir, '..', '.remarkrc.yaml');
        console.log(`Reading config from: ${originalConfigPath}`);

        if (!fs.existsSync(originalConfigPath)) {
            throw new Error(`Original config not found at ${originalConfigPath}`);
        }

        const configContent = fs.readFileSync(originalConfigPath, 'utf8');
        console.log(`Original config content:\n${configContent}`);

        // Replace relative paths with absolute paths
        const adpDevsiteUtilsRoot = path.dirname(originalConfigPath);
        console.log(`ADP devsite utils root: ${adpDevsiteUtilsRoot}`);

        let updatedConfig = configContent;

        // Replace /linter/ paths with absolute paths
        updatedConfig = updatedConfig.replace(
          /\/linter\//g,
          path.join(adpDevsiteUtilsRoot, 'linter', path.sep)
        );

        console.log(`Updated config content:\n${updatedConfig}`);

        // Create temporary config file in target repo
        const tempConfigPath = path.join(targetDir, '.remarkrc.temp.yaml');
        fs.writeFileSync(tempConfigPath, updatedConfig);

        console.log(`Created temp config at: ${tempConfigPath}`);

        // Verify the file was created
        if (!fs.existsSync(tempConfigPath)) {
            throw new Error(`Failed to create temp config file at ${tempConfigPath}`);
        }

        return tempConfigPath;

    } catch (error) {
        console.error('Error in createTempConfig:', error);
        throw error;
    }
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
