#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const {
    getDeployableFiles,
    getMarkdownFiles,
    replaceLinksInFile,
    getFindPatternForMarkdownFiles: getFindPattern,
    getReplacePatternForMarkdownFiles: getReplacePattern,
    removeFileExtension,
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
        const indexPathNormalized = indexPath.replaceAll('/', path.sep);
        const absolute = path.resolve(relativeToDir, indexPathNormalized);
        const relative = path.relative(relativeToDir, absolute);

        if (relativeFiles.find((file) => file === relative)) {
            verbose(`      Found index.md for ${linkPath} -> ${indexPath}`);
            return indexPath;
        }

        // No index.md, so convert directory path to file path
        const pathWithoutSlash = linkPath.slice(0, -1);
        const filePath = `${pathWithoutSlash}.md`;
        const filePathNormalized = filePath.replaceAll('/', path.sep);
        const absoluteFile = path.resolve(relativeToDir, filePathNormalized);
        const relativeFile = path.relative(relativeToDir, absoluteFile);

        if (relativeFiles.find((file) => file === relativeFile)) {
            verbose(`      Found file for ${linkPath} -> ${filePath}`);
            return filePath;
        }

        // File doesn't exist yet, but assume it will be the .md file
        verbose(`      No file found for ${linkPath}, assuming ${filePath}`);
        return filePath;
    }

    // ensures link includes file name and extension
    function normalizeLinksInMarkdownFile(file, files) {
        verbose(`Processing file: ${file}`);
        const relativeToDir = path.dirname(file);
        const relativeFiles = files.map((file) => path.relative(relativeToDir, file));
        const linkMap = new Map();

        const linkPattern = getFindPattern('[^)#]*');
        let data = fs.readFileSync(file, 'utf8');
        const links = data.matchAll(new RegExp(linkPattern, 'gm'));
        const linkArray = [...links];
        verbose(`  Found ${linkArray.length} links to process`);

        linkArray.forEach((link, index) => {
            const optionalPrefix = link[2] ?? '';
            const from = link[3] ?? '';
            let to = from;
            verbose(`    Link ${index + 1}: "${from}"`);

            // Handle absolute paths starting with / (project-relative paths)
            // Convert them to relative paths from the current file FIRST
            if (to.startsWith('/')) {
                verbose(`      Detected absolute path: "${to}"`);
                // Remove leading slash and resolve from project root
                const pathFromRoot = to.slice(1);
                const absoluteFromRoot = path.join(__dirname, pathFromRoot);
                // Convert to relative path from current file's directory
                to = path.relative(relativeToDir, absoluteFromRoot);
                // Convert back to URL format with forward slashes
                to = to.replaceAll(path.sep, '/');
                verbose(`      Converted to relative path: "${to}"`);
            }

            const toHasTrailingSlash = to.endsWith('/') || (optionalPrefix.endsWith('/') && !to);
            if (toHasTrailingSlash) {
                to = resolveTrailingSlashPath(to, relativeToDir, relativeFiles);
                verbose(`      Resolved trailing slash: "${from}" -> "${to}"`);
            }

            // temporarily use local machine's path separator (i.e. '\' for Windows, '/' for Mac)
            // to compare files retrieved from local machine
            to = to.replaceAll('/', path.sep);

            // ensure simplest relative path
            // this removes trailing slash, so need to do this after check for trailing slash above
            const absolute = path.resolve(relativeToDir, to);
            const relative = path.relative(relativeToDir, absolute);
            to = relative;

            // add missing file extension only if we're sure it's the right one
            // if there's more than one option, let user manually fix it
            const potentialFileExtensions = relativeFiles.filter((file) => removeFileExtension(file) === to).map((file) => path.extname(file));
            if (potentialFileExtensions.length === 1) {
                const ext = potentialFileExtensions[0];
                if (!to.endsWith(ext) && to) {
                    to = `${to}${ext}`;
                    verbose(`      Added missing extension: "${to}"`);
                }
            }

            // ensure the link we constructed above exists
            const toExists = relativeFiles.find((file) => to === file);

            // revert back to URL path separator '/'
            to = to.replaceAll(path.sep, '/');

            if (to !== from && toExists) {
                linkMap.set(from, to);
                verbose(`      Normalized: "${from}" -> "${to}"`);
            } else if (to !== from && !toExists) {
                verbose(`      Warning: Normalized link "${to}" not found in files`);
            } else {
                verbose(`      No change needed: "${from}"`);
            }
        });

        verbose(`  Final link map size: ${linkMap.size}`);
        replaceLinksInFile({
            file,
            linkMap,
            getFindPattern,
            getReplacePattern,
        });
    }

    logStep('Getting deployable files');
    const files = getDeployableFiles(__dirname);
    verbose(`Found ${files.length} deployable files`);

    logStep('Processing markdown files');
    const mdFiles = getMarkdownFiles(__dirname);
    verbose(`Processing ${mdFiles.length} markdown files`);
    mdFiles.forEach((mdFile, index) => {
        verbose(`Processing markdown file ${index + 1}/${mdFiles.length}: ${mdFile}`);
        normalizeLinksInMarkdownFile(mdFile, files);
    });

    verbose('Link normalization process completed successfully');
} catch (err) {
    log(`Link normalization failed: ${err.message}`, 'error');
    console.error(err);
}
