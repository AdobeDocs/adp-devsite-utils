#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path'
import { fileURLToPath } from 'url';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

try {
    logSection('BUILD NAVIGATION');
    logStep('Starting navigation build process');

    // regex to find sections:
    // subPages:((\s* .*)*)

    const filePath = path.join(__dirname, 'gatsby-config.js');
    verbose(`Loading gatsby-config.js from: ${filePath}`);

    const config = await import(filePath);
    const siteMetadata = config.default?.siteMetadata;
    const pathPrefix = config.default?.pathPrefix;

    if (!siteMetadata) {
        verbose('siteMetadata not found in gatsby-config.js', 'error');
        throw new TypeError("siteMetadata not found");
    }

    verbose(`Loaded siteMetadata with ${Object.keys(siteMetadata).length} properties`);

    if (!pathPrefix) {
        verbose('pathPrefix not found in gatsby-config.js', 'error');
        throw new TypeError("pathPrefix not found");
    }

    verbose(`Path prefix: ${pathPrefix}`);

    logStep('Building navigation markdown');
    let topNavMarkdown = ``;
    // TODO: prob need url fixer from gatsby theme
    // home link defines the first link defaults to Products
    // can be hidden
    // siteMetadata.versions
    // siteMetadata.home

    topNavMarkdown += `- pathPrefix:\n`;
    topNavMarkdown += `    - ${pathPrefix}\n`;
    verbose('Added pathPrefix to navigation');

    if (siteMetadata.home) {
        verbose(`Processing home configuration: ${siteMetadata.home.title}`);
        topNavMarkdown += '\n- home:\n';
        let resolvedHomePath = resolvePathToMarkdown(siteMetadata.home.path, verbose);
        topNavMarkdown += `    - [${siteMetadata.home.title}](${resolvedHomePath})\n`;

        if (siteMetadata.home.hidden) {
            topNavMarkdown += `    - hidden\n`;
            verbose('Home link marked as hidden');
        }
    } else {
        verbose('No home configuration found');
    }

    if (siteMetadata.versions) {
        verbose(`Processing ${siteMetadata.versions.length} version items`);
        topNavMarkdown += '\n- versions:\n';

        siteMetadata.versions.forEach((versionItem, index) => {
            let isSelectedText = versionItem.selected ? `selected` : '';
            let versionPathText = versionItem.path ? versionItem.path : '/';
            let resolvedVersionPath = resolvePathToMarkdown(versionPathText, verbose);
            topNavMarkdown += `    - [${versionItem.title}](${resolvedVersionPath}) ${isSelectedText}\n`;
            verbose(`  Version ${index + 1}: ${versionItem.title} (${versionPathText} -> ${resolvedVersionPath})${versionItem.selected ? ' [SELECTED]' : ''}`);
        });
    } else {
        verbose('No versions configuration found');
    }

    if (siteMetadata.pages) {
        verbose(`Processing ${siteMetadata.pages.length} page items`);
        topNavMarkdown += `\n- pages:\n`;
    } else {
        verbose('No pages configuration found');
    }

    siteMetadata.pages?.forEach((navItem, index) => {
        verbose(`  Page ${index + 1}: ${navItem.title}`);
        //let pathText = navItem.path ? navItem.path : '';
        if(navItem.path) {
            let resolvedPath = resolvePathToMarkdown(navItem.path, verbose);
            topNavMarkdown += `    - [${navItem.title}](${resolvedPath})\n`;
            verbose(`    Direct link: ${navItem.path} -> ${resolvedPath}`);
        } else {
            topNavMarkdown += `    - ${navItem.title}\n`;
            verbose(`    Menu with ${navItem.menu?.length || 0} sub-items`);
            navItem.menu?.forEach((menuItem, menuIndex) =>{
                let resolvedMenuPath = resolvePathToMarkdown(menuItem.path, verbose);
                let descriptionText = menuItem.description ? ` - ${menuItem.description}` : '';
                topNavMarkdown += `        - [${menuItem.title}](${resolvedMenuPath})${descriptionText}\n`;
                verbose(`      Sub-item ${menuIndex + 1}: ${menuItem.title} -> ${menuItem.path} -> ${resolvedMenuPath}${menuItem.description ? ` (${menuItem.description})` : ''}`);
            });
        }
    });

    if (siteMetadata.subPages) {
        verbose(`Processing subPages configuration`);
        topNavMarkdown += `\n- subPages:\n`;
        let sideNavMarkdown = ``;
        let depth = 1;

        logStep('Building side navigation recursively');
        sideNavMarkdown += buildSideNavRecursively(siteMetadata.subPages, depth, verbose);
        topNavMarkdown += sideNavMarkdown;
        verbose(`Generated ${sideNavMarkdown.split('\n').filter(line => line.trim()).length} side navigation items`);
    } else {
        verbose('No subPages configuration found');
    }

    let configFilePath = path.resolve(__dirname + '/src/pages/config.md');
    verbose(`Writing navigation config to: ${configFilePath}`);
    fs.writeFileSync(configFilePath, topNavMarkdown);
    verbose(`Navigation config written successfully (${topNavMarkdown.length} characters)`);
    console.log(`Generated file: ${configFilePath}`);

} catch (err) {
    log(`Navigation build failed: ${err.message}`, 'error');
    console.error(err);
}
// subpages menu should only appear on the subpages path
// need to check paths to
function buildSideNavRecursively(sideNav, depth, verbose) {
    let sideNavMarkdown = '';

    for (var k in sideNav) {
        let header = sideNav[k].header ? ' - header' : ''; 
        let resolvedPath = resolvePathToMarkdown(sideNav[k].path, verbose);
        sideNavMarkdown += header ? `${insertSpace(depth)}- ${sideNav[k].title}${header}\n` : `${insertSpace(depth)}- [${sideNav[k].title}](${resolvedPath})\n`;
        verbose(`    Side nav item: ${sideNav[k].title} (depth ${depth}) -> ${resolvedPath}`);

        if (sideNav[k].pages) {
            verbose(`    Processing ${Object.keys(sideNav[k].pages).length} sub-pages for ${sideNav[k].title}`);
            // If it's a header, don't add indent level for sub-pages
            let nextDepth = header ? depth : depth + 1;
            sideNavMarkdown += buildSideNavRecursively(sideNav[k].pages, nextDepth, verbose);
        }
    }
    return sideNavMarkdown;
}

/**
 * Resolves a path with trailing slash to the appropriate .md file
 * - If path ends with /, checks if <path>/index.md exists -> returns <path>/index.md
 * - If path ends with / and no index.md exists -> returns <path-without-slash>.md
 * - If path doesn't end with /, returns as-is
 */
function resolvePathToMarkdown(urlPath, verbose) {
    if (!urlPath || !urlPath.endsWith('/')) {
        return urlPath;
    }

    // Remove leading slash and convert to file system path
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;

    // Check if index.md exists in the directory
    const indexPath = path.join(__dirname, 'src/pages', relativePath, 'index.md');

    if (fs.existsSync(indexPath)) {
        verbose(`      Found index.md for ${urlPath} -> ${urlPath}index.md`);
        return `${urlPath}index.md`;
    }

    // No index.md, so convert directory path to file path
    const pathWithoutSlash = urlPath.slice(0, -1);
    const filePath = path.join(__dirname, 'src/pages', relativePath.slice(0, -1) + '.md');

    if (fs.existsSync(filePath)) {
        verbose(`      Found file for ${urlPath} -> ${pathWithoutSlash}.md`);
        return `${pathWithoutSlash}.md`;
    }

    // File doesn't exist yet, but assume it will be the .md file
    verbose(`      No file found for ${urlPath}, assuming ${pathWithoutSlash}.md`);
    return `${pathWithoutSlash}.md`;
}

function insertSpace(indentLevel) {
    let spaces = ``;
    for (var i = 0; i < indentLevel; i++) {
        spaces += `    `;
    }
    return spaces;
}

// src/pages/topNav.md
// src/pages/sideNav.md
// src/pages/get-started/sideNav.md

// go through each subPages and find each path that relates to a subfolder


// title with path only
// header setting
