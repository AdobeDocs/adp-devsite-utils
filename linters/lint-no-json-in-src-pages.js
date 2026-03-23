import fs from 'node:fs';
import path from 'path';

const RULE_ID = 'no-json-in-src-pages';

const EDS_SHEET_KEYS = ['total', 'offset', 'limit', 'data', ':type'];

function isEdsSheet(filePath) {
    try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return EDS_SHEET_KEYS.every(key => key in content)
            && content[':type'] === 'sheet'
            && Array.isArray(content.data);
    } catch {
        return false;
    }
}

function findJsonFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            files.push(...findJsonFiles(fullPath));
        } else if (path.extname(entry.name).toLowerCase() === '.json') {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Scans subdirectories of srcPagesDir for JSON files that don't belong there.
 * The EDS deploy pipeline pushes every file under src/pages/ through the
 * md2markup service, which only understands markdown. JSON data files in
 * subdirectories cause 400 errors during deployment.
 *
 * Root-level JSON files in src/pages/ (e.g. redirects.json,
 * adp-site-metadata.json) are expected and not checked.
 *
 * JSON files in AEM shapes(containing keys: total,
 * offset, limit, data, :type) are also allowed.
 *
 * @param {string} srcPagesDir - Absolute path to src/pages/
 * @param {string} baseDir     - Repo root, used for relative-path display
 * @returns {{ files: string[], messages: Array<{file: string, message: string, ruleId: string}> }}
 */
export default function lintNoJsonInSrcPages(srcPagesDir, baseDir) {
    const found = [];
    const entries = fs.readdirSync(srcPagesDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.isDirectory()) {
            found.push(...findJsonFiles(path.join(srcPagesDir, entry.name)));
        }
    }

    const invalid = found.filter(f => !isEdsSheet(f));

    const messages = invalid.map(filePath => {
        const relativePath = path.relative(baseDir, filePath);
        const suggestedPath = path.join('static', path.relative(srcPagesDir, filePath));
        return {
            file: relativePath,
            message: `JSON file found in src/pages/. JSON data files are not supported by the EDS deploy pipeline and will cause deployment errors. Suggested fix: move this file to "${suggestedPath}".`,
            ruleId: RULE_ID,
        };
    });

    return { files: invalid, messages };
}
