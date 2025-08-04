#!/usr/bin/env node

import fs from 'node:fs';
import path from 'path'
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

    logSection('BUILD NAVIGATION');
    logStep('Starting navigation build process');

    // regex to find sections:
    // subPages:((\s* .*)*)

    const currentDir = process.cwd();
    verbose(`Current directory: ${currentDir}`);

    const filePath = path.join(currentDir, 'gatsby-config.js');
    verbose(`Loading gatsby-config.js from: ${filePath}`);

    const { siteMetadata, pathPrefix } = await import(filePath);
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
        topNavMarkdown += `    - [${siteMetadata.home.title}](${siteMetadata.home.path})\n`;

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
            topNavMarkdown += `    - [${versionItem.title}](${versionPathText}) ${isSelectedText}\n`;
            verbose(`  Version ${index + 1}: ${versionItem.title} (${versionPathText})${versionItem.selected ? ' [SELECTED]' : ''}`);
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
            topNavMarkdown += `    - [${navItem.title}](${navItem.path})\n`;
            verbose(`    Direct link: ${navItem.path}`);
        } else {
            topNavMarkdown += `    - ${navItem.title}\n`;
            verbose(`    Menu with ${navItem.menu?.length || 0} sub-items`);
            navItem.menu?.forEach((menuItem, menuIndex) =>{
                topNavMarkdown += `        - [${menuItem.title}](${menuItem.path})\n`;
                verbose(`      Sub-item ${menuIndex + 1}: ${menuItem.title} -> ${menuItem.path}`);
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
        let header = sideNav[k].header ? 'header' : ''; 
        sideNavMarkdown += `${insertSpace(depth)}- [${sideNav[k].title}](${sideNav[k].path}) ${header}\n`;
        verbose(`    Side nav item: ${sideNav[k].title} (depth ${depth})${header ? ' [HEADER]' : ''}`);

        if (sideNav[k].pages) {
            verbose(`    Processing ${Object.keys(sideNav[k].pages).length} sub-pages for ${sideNav[k].title}`);
            sideNavMarkdown += buildSideNavRecursively(sideNav[k].pages, depth + 1, verbose);
        }
    }
    return sideNavMarkdown;
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