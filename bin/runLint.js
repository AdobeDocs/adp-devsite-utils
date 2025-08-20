import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

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
    // For custom linter plugins, use the full path from adp-devsite-utils repo
    path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-check-frontmatter.js'),
    path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-no-angle-brackets.js'),
    path.join(adpDevsiteUtilsDir, 'linter', 'remark-lint-self-close-component.js')
];

logSection('RUN LINT');
logStep('Starting remark linting process');

verbose(`Running remark with ${PLUGINS.length} plugin(s)`);

// Build the command array with all plugins
const commandArgs = [
    'remark',
    path.join(process.cwd(), 'src', 'pages'),
    '--quiet'
];

// Add each plugin with --use flag
PLUGINS.forEach(plugin => {
    commandArgs.push('--use', plugin);
});

verbose(`Command: npx ${commandArgs.join(' ')}`);

// Run remark with the specified plugins
const remarkProcess = spawn('npx', commandArgs, {
    cwd: adpDevsiteUtilsDir, // Run from adp-devsite-utils repo
    stdio: 'inherit'
});

remarkProcess.on('close', (code) => {
    verbose(`Remark process exited with code: ${code}`);

    if (code === 0) {
        log('✅ All markdown files passed linting!', 'success');
        verbose(`Exit code: ${code} - Success`);
    } else {
        log('❌ Linting completed with issues', 'warn');
        verbose(`Exit code: ${code} - Issues found`);
        process.exit(code); // Exit with the same code that remark returned
    }
});

remarkProcess.on('error', (error) => {
    log(`Failed to start remark: ${error.message}`, 'error');
    verbose(`Process error occurred`);
    process.exit(1);
});
