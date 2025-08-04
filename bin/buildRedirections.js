#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { path, dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    const currentDir = process.cwd();
    const filePath = path.join(currentDir, 'gatsby-config.js');
    const { pathPrefix } = await import(filePath);

    const { globSync } = await import('glob');
    const { writeRedirectionsFile } = await import('./scriptUtils.js');

    if(!pathPrefix) {
        throw new TypeError("pathPrefix not found");
    } 

    let results = globSync(__dirname + '/src/pages/**/*.md');
    let data = [];

    results.forEach(mdFilePath => {
        mdFilePath = mdFilePath.replace(__dirname + '/src/pages', pathPrefix);
        mdFilePath = path.resolve(mdFilePath);

        // Fixes paths that don't end in a trailing slash but should.
        // index.md is a directory-level URL that needs a trailing slash
        if(mdFilePath.endsWith('index.md')) {
            const source = mdFilePath.replace('/index.md', '');
            data.push({
                "Source" : source,
                "Destination" : source + '/'
            });
            data.push({
                "Source" : source + '/index',
                "Destination" : source + '/'
            });
        }
        // Fixes paths that end in a trailing slash but shouldn't.
        // skip any index.md or config.md as they don't need redirect
        else if(!mdFilePath.endsWith('config.md')) {
            const source = mdFilePath.replace('.md', '/');
            data.push({
                "Source" : source,
                "Destination" : source.replace(/\/$/, "")
            });
        }
    });

    writeRedirectionsFile(data);

} catch (err) {
    console.error(err);
}
