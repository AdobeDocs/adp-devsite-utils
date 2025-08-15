import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

async function runLint() {
    try {
        logSection('RUN LINT');
        logStep('Starting markdown linting process');

        // Check if package.json exists
        const packageJsonPath = path.join(__dirname, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            log('No package.json found in current directory', 'error');
            console.error('❌ No package.json found.');
            process.exit(1);
        }

        // Check if .remarkrc.yaml exists
        const remarkConfigPath = path.join(__dirname, '.remarkrc.yaml');
        if (!fs.existsSync(remarkConfigPath)) {
            log('No .remarkrc.yaml found in current directory', 'error');
            console.error('❌ No .remarkrc.yaml configuration file found.');
            console.error('Please create a .remarkrc.yaml file with your linting rules.');
            process.exit(1);
        }

        logStep('Running lint:fast script from package.json');
        console.log('\nRunning lint:fast script...');

        try {
            // Run the lint:fast script from package.json
            const result = await runNpmScript('lint:fast');
            
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

async function runNpmScript(scriptName) {
    return new Promise((resolve, reject) => {
        // Set a reasonable timeout (5 minutes)
        const timeout = 300000; // 5 minutes
        
        console.log(`Setting timeout to ${Math.round(timeout/1000)} seconds...`);
        
        const npmProcess = spawn('npm', ['run', scriptName], {
            cwd: __dirname,
            stdio: 'pipe'
        });

        let stdout = '';
        let stderr = '';

        npmProcess.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        npmProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
            npmProcess.kill('SIGTERM');
            reject(new Error(`Linting timed out after ${Math.round(timeout/1000)} seconds.`));
        }, timeout);

        npmProcess.on('close', (code) => {
            clearTimeout(timeoutId);
            
            if (code === 0) {
                resolve({ success: true, stdout, stderr });
            } else {
                // Show the output from the failed npm script
                if (stdout) console.log('\nScript output:', stdout);
                if (stderr) console.error('\nScript errors:', stderr);
                resolve({ success: false, stdout, stderr });
            }
        });

        npmProcess.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to run npm script: ${error.message}`));
        });
    });
}

// Call the main function
runLint().catch(error => {
    console.error('Error while running lint:', error);
    process.exit(1);
});