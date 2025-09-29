#!/usr/bin/env node

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

try {
    logSection('BUILD REDIRECTIONS');
    logStep('Starting redirections build process');


    verbose(`All env vars: ${Object.keys(process.env).join(', ')}`);

    const currentDir = process.cwd();
    verbose(`Current directory: ${currentDir}`);

    const filePath = path.join(currentDir, 'gatsby-config.js');
    verbose(`Loading gatsby-config.js from: ${filePath}`);

    const config = await import(filePath);
    const pathPrefix = config.default?.pathPrefix;

    verbose(`Loaded pathPrefix: ${pathPrefix}`);

    const { globSync } = await import('glob');
    const { writeRedirectionsFile } = await import('./scriptUtils.js');

    if (!pathPrefix) {
        verbose('pathPrefix not found in gatsby-config.js', 'error');
        throw new TypeError("pathPrefix not found");
    }

    logStep('Finding markdown files');
    let results = globSync(__dirname + '/src/pages/**/*.md');
    verbose(`Found ${results.length} markdown files`);

    let data = [];
    let indexRedirects = 0;
    let trailingSlashRedirects = 0;

    logStep('Processing markdown files for redirections');
    results.forEach((mdFilePath, index) => {
        verbose(`  Processing file ${index + 1}/${results.length}: ${mdFilePath}`);

        mdFilePath = mdFilePath.replace(__dirname + '/src/pages', pathPrefix);
        mdFilePath = path.resolve(mdFilePath);
        verbose(`    Normalized path: ${mdFilePath}`);

        // Fixes paths that don't end in a trailing slash but should.
        // index.md is a directory-level URL that needs a trailing slash
        if (mdFilePath.endsWith('index.md')) {
            const source = mdFilePath.replace('/index.md', '');
            data.push({
                "source": source,
                "destination": source + '/'
            });
            data.push({
                "source": source + '/index',
                "destination": source + '/'
            });
            indexRedirects += 2;
            verbose(`    Added index redirects for: ${source}`);
        }
        // Fixes paths that end in a trailing slash but shouldn't.
        // skip any index.md or config.md as they don't need redirect
        else if (!mdFilePath.endsWith('config.md')) {
            const source = mdFilePath.replace('.md', '/');
            data.push({
                "source": source,
                "destination": source.replace(/\/$/, "")
            });
            trailingSlashRedirects++;
            verbose(`    Added trailing slash redirect for: ${source}`);
        } else {
            verbose(`    Skipped config.md file`);
        }
    });

    verbose(`Total redirects created: ${data.length}`);
    verbose(`  Index redirects: ${indexRedirects}`);
    verbose(`  Trailing slash redirects: ${trailingSlashRedirects}`);

    verbose('Redirections file written successfully');

    // Redirects have been written to src/pages/redirects.json
    // fastlyRedirects.js will read from this file instead of stdin

} catch (err) {
    log(`Redirections build failed: ${err.message}`, 'error');
    console.error(err);
}
