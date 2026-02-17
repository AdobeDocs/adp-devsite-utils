#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';

const {
    getDeployableFiles,
    getMarkdownFiles,
    replaceLinksInFile,
    getFindPatternForMarkdownFiles: getFindPattern,
    getReplacePatternForMarkdownFiles: getReplacePattern,
    log,
    verbose,
    logSection,
    logStep,
} = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

try {
    logSection('NORMALIZE LINKS');
    logStep('Starting link normalization process');

    /**
     * Helper: Check if a path exists in relativeFiles
     */
    function pathExists(urlPath, relativeToDir, relativeFiles) {
        const osPath = urlPath.replaceAll('/', path.sep);
        const absolute = path.resolve(relativeToDir, osPath);
        const relative = path.relative(relativeToDir, absolute);
        return relativeFiles.includes(relative);
    }

    /**
     * Resolves a path with trailing slash to the appropriate .md file
     * - If path ends with /, checks if <path>/index.md exists -> returns <path>/index.md
     * - If path ends with / and no index.md exists -> returns <path-without-slash>.md
     * - If path doesn't end with /, returns as-is
     */
    function resolveTrailingSlashPath(linkPath, relativeToDir, relativeFiles) {
        if (!linkPath.endsWith('/')) {
            return linkPath;
        }

        // Check if index.md exists in the directory
        const indexPath = `${linkPath}index.md`;
        if (pathExists(indexPath, relativeToDir, relativeFiles)) {
            return indexPath;
        }

        // No index.md, convert to .md file
        return `${linkPath.slice(0, -1)}.md`;
    }

    // ensures link includes file name and extension
    function normalizeLinksInMarkdownFile(file, files) {
        verbose(`Processing file: ${file}`);
        const relativeToDir = path.dirname(file);
        const absoluteToDir = path.resolve(__dirname, relativeToDir);
        const relativeFiles = files.map((file) => path.relative(relativeToDir, file));
        const linkMap = new Map();

        const linkPattern = getFindPattern('[^)#]*');
        let data = fs.readFileSync(file, 'utf8');
        const links = data.matchAll(new RegExp(linkPattern, 'gm'));
        const linkArray = [...links];
        verbose(`  Found ${linkArray.length} links to process`);

        linkArray.forEach((link, index) => {
            const optionalPrefix = link[2] ?? '';
            const fromPath = link[3] ?? '';
            // Reconstruct full path including the prefix (/, ./, or nothing)
            const from = optionalPrefix ? optionalPrefix + fromPath : fromPath;
            let to = from;

            // Resolve trailing slashes FIRST (before normalization removes them)
            if (to.endsWith('/')) {
                to = resolveTrailingSlashPath(to, relativeToDir, relativeFiles);
            }

            // Handle absolute paths starting with / (project-relative paths)
            // Convert them to relative paths from the current file
            if (to.startsWith('/')) {
                const pathFromRoot = to.slice(1);
                const absoluteFromRoot = path.join(__dirname, pathFromRoot);
                to = path.relative(absoluteToDir, absoluteFromRoot);
                to = to.replaceAll(path.sep, '/');
            } else {
                // Normalize relative paths to simplest form
                const osPath = to.replaceAll('/', path.sep);
                const absolute = path.resolve(relativeToDir, osPath);
                to = path.relative(relativeToDir, absolute);
                to = to.replaceAll(path.sep, '/');
            }

            // Resolve path to a specific file: prefer .md file, then directory/index.md
            const hasExtension = path.extname(to) !== '';
            if (!hasExtension) {
                if (pathExists(`${to}.md`, relativeToDir, relativeFiles)) {
                    to = `${to}.md`;
                } else if (pathExists(`${to}/index.md`, relativeToDir, relativeFiles)) {
                    to = `${to}/index.md`;
                }
            }

            // Check if the normalized link exists
            const toExists = pathExists(to, relativeToDir, relativeFiles);

            if (to !== from && toExists) {
                linkMap.set(from, to);
                verbose(`    "${from}" -> "${to}"`);
            } else if (to !== from && !toExists) {
                verbose(`    Warning: "${from}" -> "${to}" (not found)`);
            }
        });

        verbose(`  Final link map size: ${linkMap.size}`);
        replaceLinksInFile({
            file,
            linkMap,
            getFindPattern,
            getReplacePattern,
        });
        return linkMap;
    }

    logStep('Getting deployable files');
    const files = getDeployableFiles(__dirname);
    verbose(`Found ${files.length} deployable files`);

    logStep('Processing markdown files');
    const mdFiles = getMarkdownFiles(__dirname);
    verbose(`Processing ${mdFiles.length} markdown files`);
    const allChanges = [];
    mdFiles.forEach((mdFile, index) => {
        verbose(`Processing markdown file ${index + 1}/${mdFiles.length}: ${mdFile}`);
        const linkMap = normalizeLinksInMarkdownFile(mdFile, files);
        if (linkMap.size > 0) {
            allChanges.push({ file: mdFile, linkMap });
        }
    });

    if (allChanges.length > 0) {
        log('\nLinks changed:');
        allChanges.forEach(({ file, linkMap }) => {
            log(`  ${file}`);
            linkMap.forEach((to, from) => {
                log(`    ${from} → ${to}`);
            });
        });
    } else {
        log('No links were changed.');
    }

    verbose('Link normalization process completed successfully');
} catch (err) {
    log(`Link normalization failed: ${err.message}`, 'error');
    console.error(err);
}
