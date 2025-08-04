#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const {
    getPathPrefix,
    readRedirectionsFile,
    writeRedirectionsFile,
    getRedirectionsFilePath,
    getDeployableFiles,
    getMarkdownFiles,
    getFindPatternForMarkdownFiles,
    getReplacePatternForMarkdownFiles,
    removeFileExtension,
    replaceLinksInFile,
    replaceLinksInString,
    log,
    verbose,
    logSection,
    logStep,
} = await import('./scriptUtils.js');

try {

    logSection('RENAME FILES');
    logStep('Starting file rename process');

    function toKebabCase(str) {
        const isScreamingSnakeCase = new RegExp(/^[A-Z0-9_]*$/).test(str);
        str = isScreamingSnakeCase ? str.toLowerCase() : str;
        return str
            .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
            .map((x) => x.toLowerCase())
            .join('-');
    }

    function toEdsCase(str) {
        const isValid = Boolean(/^([a-z0-9-]*)$/.test(str));
        return isValid ? str : toKebabCase(str);
    }

    function toUrl(str) {
        let url = removeFileExtension(str);

        // replace '/index' with trailing slash
        if (url.endsWith('/index')) {
            const index = url.lastIndexOf('index');
            url = url.substring(0, index);
        }

        return url;
    }

    function removeTrailingSlash(str) {
        if (str.endsWith('/')) {
            const index = str.length - 1;
            str = str.substring(0, index);
        }
        return str;
    }

    function toEdsPath(file) {
        const renamedFileWithoutExt = removeFileExtension(file)
            .split(path.sep)
            .map((token) => toEdsCase(token))
            .join(path.sep);
        const ext = path.extname(file);
        return `${renamedFileWithoutExt}${ext}`;
    }

    function getFileMap(files) {
        verbose(`Processing ${files.length} files for renaming`);
        const map = new Map();
        let renamedCount = 0;

        files.forEach((from, index) => {
            const to = toEdsPath(from);
            if (to !== from) {
                map.set(from, to);
                verbose(`  File ${index + 1}: "${from}" -> "${to}"`);
                renamedCount++;
            } else {
                verbose(`  File ${index + 1}: "${from}" (no change needed)`);
            }
        });

        verbose(`Total files to rename: ${renamedCount}`);
        return map;
    }

    function getLinkMap(fileMap, relativeToDir) {
        const linkMap = new Map();
        fileMap.forEach((toFile, fromFile) => {
            let fromRelFile = path.relative(relativeToDir, fromFile);
            fromRelFile = fromRelFile.replaceAll(path.sep, '/');

            let toRelFile = path.relative(relativeToDir, toFile);
            toRelFile = toRelFile.replaceAll(path.sep, '/');

            linkMap.set(fromRelFile, toRelFile);
        });
        return linkMap;
    }

    function renameLinksInGatsbyConfigFile(fileMap, file) {
        const dir = path.join('src', 'pages');
        replaceLinksInFile({
            file,
            linkMap: getLinkMap(fileMap, dir),
            getFindPattern: (from) => `(['"]?path['"]?\\s*:\\s*['"])(/|./)?(${from})(#[^'"]*)?(['"])`,
            getReplacePattern: (to) => `$1$2${to}$4$5`,
        });
    }

    function renameLinksInMarkdownFile(fileMap, file) {
        verbose(`Processing markdown file: ${file}`);
        const dir = path.dirname(file);
        const linkMap = getLinkMap(fileMap, dir);
        verbose(`  Found ${linkMap.size} links to update in ${file}`);

        replaceLinksInFile({
            file,
            linkMap,
            getFindPattern: getFindPatternForMarkdownFiles,
            getReplacePattern: getReplacePatternForMarkdownFiles,
        });
    }

    function getRenamedUrl(fromUrl, patterns, linkMap) {
        let pattern;
        patterns.forEach((p) => {
            linkMap.forEach((_, f) => {
                const find = p.getFindPattern(f);
                const test = new RegExp(find).test(fromUrl);
                if (test) {
                    pattern = p;
                }
            });
        });
        const toUrl = pattern
            ? replaceLinksInString({
                  string: fromUrl,
                  linkMap,
                  getFindPattern: pattern.getFindPattern,
                  getReplacePattern: pattern.getReplacePattern,
              })
            : null;
        return toUrl;
    }

    function renameLinksInRedirectsFile(fileMap, pathPrefix) {
        const patterns = [
            // paths that exist in the repo
            {
                getFindPattern: (from) => `^(${pathPrefix}${toUrl(from)})(#.*)?$`,
                getReplacePattern: (to) => `${pathPrefix}${toUrl(to)}$2`,
            },
            // paths that don't end in a trailing slash but should, i.e. non-existent paths added by 'buildRedirections.js'
            {
                getFindPattern: (from) => `^(${pathPrefix}${removeTrailingSlash(toUrl(from))})(#.*)?$`,
                getReplacePattern: (to) => `${pathPrefix}${removeTrailingSlash(toUrl(to))}$2`,
            },
            // paths that end with '/index' but should end with a trailing slash, i.e. non-normalized paths added by 'buildRedirections.js'
            {
                getFindPattern: (from) => `^(${pathPrefix}${removeTrailingSlash(toUrl(from))}/index)(#.*)?$`,
                getReplacePattern: (to) => `${pathPrefix}${removeTrailingSlash(toUrl(to))}/index$2`,
            },
            // paths that end in a trailing slash, but shouldn't, i.e. non-existent paths added by 'buildRedirections.js'
            {
                getFindPattern: (from) => `^(${pathPrefix}${toUrl(from)}/)(#.*)?$`,
                getReplacePattern: (to) => `${pathPrefix}${toUrl(to)}/$2`,
            },
        ];

        const file = getRedirectionsFilePath();
        const dir = path.dirname(file);
        const linkMap = getLinkMap(fileMap, dir);
        const newRedirects = [];

        const currRedirects = readRedirectionsFile();
        currRedirects.forEach(({ Source: currSource, Destination: currDestination }) => {
            const newSource = getRenamedUrl(currSource, patterns, linkMap);
            const newDestination = getRenamedUrl(currDestination, patterns, linkMap);
            if (!newSource && !newDestination) {
                newRedirects.push({
                    Source: currSource,
                    Destination: currDestination,
                });
            } else if (!newSource && newDestination) {
                newRedirects.push({
                    Source: currSource,
                    Destination: newDestination,
                });
            } else if (newSource && !newDestination) {
                newRedirects.push({
                    Source: currSource,
                    Destination: currDestination,
                });
                newRedirects.push({
                    Source: newSource,
                    Destination: currDestination,
                });
            } else {
                newRedirects.push({
                    Source: currSource,
                    Destination: newDestination,
                });
                newRedirects.push({
                    Source: newSource,
                    Destination: newDestination,
                });
            }
        });

        linkMap.forEach((to, from) => {
            newRedirects.push({
                Source: `${pathPrefix}${toUrl(from)}`,
                Destination: `${pathPrefix}${toUrl(to)}`,
            });
        });

        writeRedirectionsFile(newRedirects);
    }

    function deleteEmptyDirectoryUpwards(startDir, stopDir) {
        const isEmpty = fs.readdirSync(startDir).length === 0;
        if (isEmpty && startDir !== stopDir) {
            fs.rmdirSync(startDir);
            deleteEmptyDirectoryUpwards(path.dirname(startDir), stopDir);
        }
    }

    function renameFiles(map) {
        verbose(`Starting file rename operation for ${map.size} files`);

        // create new dirs
        logStep('Creating directories');
        let dirsCreated = 0;
        map.forEach((to, _) => {
            const toDir = path.dirname(to);
            if (!fs.existsSync(toDir)) {
                fs.mkdirSync(toDir, { recursive: true });
                verbose(`  Created directory: ${toDir}`);
                dirsCreated++;
            }
        });
        verbose(`Created ${dirsCreated} directories`);

        // rename
        logStep('Renaming files');
        let filesRenamed = 0;
        map.forEach((to, from) => {
            fs.renameSync(from, to);
            verbose(`  Renamed: "${from}" -> "${to}"`);
            filesRenamed++;
        });
        verbose(`Renamed ${filesRenamed} files`);

        // delete old dirs
        logStep('Cleaning up empty directories');
        let dirsRemoved = 0;
        map.forEach((_, from) => {
            const fromDir = path.dirname(from);
            if (fs.existsSync(fromDir)) {
                const beforeCount = fs.readdirSync(fromDir).length;
                deleteEmptyDirectoryUpwards(fromDir, __dirname);
                const afterCount = fs.existsSync(fromDir) ? fs.readdirSync(fromDir).length : 0;
                if (beforeCount !== afterCount) {
                    verbose(`  Cleaned up directory: ${fromDir}`);
                    dirsRemoved++;
                }
            }
        });
        verbose(`Cleaned up ${dirsRemoved} directories`);
    }

    logStep('Getting deployable files');
    const files = getDeployableFiles();
    verbose(`Found ${files.length} deployable files`);

    logStep('Creating file map');
    const fileMap = getFileMap(files);

    logStep('Processing markdown files');
    const mdFiles = getMarkdownFiles();
    verbose(`Processing ${mdFiles.length} markdown files`);
    mdFiles.forEach((mdFile, index) => {
        verbose(`  Processing markdown file ${index + 1}/${mdFiles.length}: ${mdFile}`);
        renameLinksInMarkdownFile(fileMap, mdFile);
    });

    logStep('Processing redirects file');
    const redirectsFile = getRedirectionsFilePath();
    const pathPrefix = await getPathPrefix();
    verbose(`Path prefix: ${pathPrefix}`);
    if (fs.existsSync(redirectsFile)) {
        verbose(`Redirects file found: ${redirectsFile}`);
        renameLinksInRedirectsFile(fileMap, pathPrefix);
    } else {
        verbose('No redirects file found, skipping');
    }

    logStep('Processing gatsby config file');
    const gatsbyConfigFile = 'gatsby-config.js';
    if (fs.existsSync(gatsbyConfigFile)) {
        verbose(`Gatsby config file found: ${gatsbyConfigFile}`);
        renameLinksInGatsbyConfigFile(fileMap, gatsbyConfigFile);
    } else {
        verbose('No gatsby config file found, skipping');
    }

    logStep('Executing file renames');
    renameFiles(fileMap);

    verbose('File rename process completed successfully');
} catch (err) {
    log(`File rename process failed: ${err.message}`, 'error');
    console.error(err);
}
