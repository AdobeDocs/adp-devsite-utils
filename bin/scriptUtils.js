#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

// Verbose logging utility
const VERBOSE = process.env.VERBOSE === 'true' || process.argv.includes('--verbose') || process.argv.includes('-v');

function log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    if (level === 'error') {
        console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
        console.warn(`${prefix} ${message}`);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

function verbose(message, level = 'info') {
    if (VERBOSE) {
        log(message, level);
    }
}

function logSection(title) {
    if (VERBOSE) {
        log(`\n${'='.repeat(50)}`);
        log(`SECTION: ${title}`);
        log(`${'='.repeat(50)}`);
    }
}

function logStep(step, details = '') {
    if (VERBOSE) {
        log(`STEP: ${step}${details ? ` - ${details}` : ''}`);
    }
}

function getPathPrefixFromConfig() {
    const CONFIG_PATH = path.join('src', 'pages', 'config.md');
    if (!fs.existsSync(CONFIG_PATH)) {
        return null;
    }

    const data = fs.readFileSync(CONFIG_PATH).toString();
    if (!data) {
        return null;
    }

    const lines = data.split('\n');

    // find the pathPrefix key
    const keyIndex = lines.findIndex((line) => new RegExp(/\s*-\s*pathPrefix:/).test(line));
    if (keyIndex < 0) {
        return null;
    }

    // find the pathPrefix value
    const line = lines.slice(keyIndex + 1)?.find((line) => new RegExp(/\s*-/).test(line));
    if (!line) {
        return null;
    }

    // extract pathPrefix
    const pathPrefixLine = line.match(new RegExp(/(\s*-\s*)(\S*)(\s*)/));
    if (!pathPrefixLine) {
        return null;
    }
    return pathPrefixLine[2];
}

async function getPathPrefixFromGatsbyConfig() {
    try {
        const config = await import('./gatsby-config.js');
        return config.default?.pathPrefix;
    } catch (error) {
        verbose(`Failed to load gatsby-config.js: ${error.message}`, 'warn');
        return null;
    }
}

async function getPathPrefix() {
    return getPathPrefixFromConfig() ?? await getPathPrefixFromGatsbyConfig();
}

function getRedirectionsFilePath(__dirname) {
    const redirectionsFilePath = path.join(__dirname, 'redirects.json');
    return path.resolve(redirectionsFilePath);
}

function readRedirectionsFile(__dirname) {
    const redirectionsFilePath = getRedirectionsFilePath(__dirname);
    return JSON.parse(fs.readFileSync(redirectionsFilePath)).data;
}

function writeRedirectionsFile(data, __dirname) {
    let redirectionsData = {
        total: data.length,
        offset: 0,
        limit: data.length,
        data: data,
        ':type': 'sheet',
    };

    let redirectionsFilePath = getRedirectionsFilePath(__dirname);
    verbose(`Writing redirections file to: ${redirectionsFilePath}`);
    fs.writeFileSync(redirectionsFilePath, JSON.stringify(redirectionsData));
}

function getFiles(fileExtensions, __dirname) {
    const fileExtensionsPattern = fileExtensions.join('|');
    return globSync(__dirname + `/src/pages/**/*+(${fileExtensionsPattern})`).map((f) => path.relative(__dirname, f));
}

function getDeployableFiles(__dirname) {
    // files types deployed to EDS in process-mds.sh
    return getFiles(['.md', '.json'], __dirname);
}

function getMarkdownFiles(__dirname) {
    return getFiles(['.md'], __dirname);
}

function removeFileExtension(file) {
    const base = path.basename(file);
    const ext = path.extname(file);
    const end = file.length - base.length;
    const baseWithoutExt = base.substring(0, base.length - ext.length);
    return `${file.substring(0, end)}${baseWithoutExt}`;
}

const getFindPatternForMarkdownFiles = (from) => `(\\[[^\\]]*]\\()(/|./)?(${from})(#[^\\()]*)?(\\))`;
const getReplacePatternForMarkdownFiles = (to) => `$1$2${to}$4$5`;

function replaceLinksInFile({ file, linkMap, getFindPattern, getReplacePattern }) {
    let data = fs.readFileSync(file, 'utf8');
    data = replaceLinksInString({ string: data, linkMap, getFindPattern, getReplacePattern });
    fs.writeFileSync(file, data, 'utf-8');
}

function replaceLinksInString({ string, linkMap, getFindPattern, getReplacePattern }) {
    linkMap.forEach((to, from) => {
        const find = getFindPattern(from);
        const replace = getReplacePattern(to);
        string = string.replaceAll(new RegExp(find, 'gm'), replace);
    });
    return string;
}

export {
    getPathPrefix,
    getRedirectionsFilePath,
    readRedirectionsFile,
    writeRedirectionsFile,
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
    VERBOSE,
};
