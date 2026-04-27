#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const { log, verbose, logSection, logStep, getMarkdownFiles } = await import('./scriptUtils.js');

const __dirname = process.cwd();
verbose(`Current directory: ${__dirname}`);

const CONTRIBUTORS_FILE_PATH = path.join('src', 'pages', 'contributors.json');
const FULL_BUILD = process.argv.includes('--all');

function getTokenFromCredentialHelper() {
  try {
    const output = execSync(
      'printf "protocol=https\\nhost=github.com\\n" | git credential fill',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const match = output.match(/^password=(.+)$/m);
    return match?.[1]?.trim() ?? null;
  } catch {
    return null;
  }
}

function getToken() {
  // for github actions
  if (process.env.GITHUB_TOKEN) {
    logStep('Using GITHUB_TOKEN from environment');
    return process.env.GITHUB_TOKEN;
  }

  // for local development
  const credentialToken = getTokenFromCredentialHelper();
  if (credentialToken) {
    logStep('Using token from git credential helper');
    return credentialToken;
  }

  return null;
}

function getRepoInfo() {
  // for github actions
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
    return { owner, repo };
  }

  // for local development
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  } catch {
    // fall through
  }

  return null;
}

function getCurrentBranch() {
  // for github actions
  if (process.env.GITHUB_HEAD_REF) {
    return process.env.GITHUB_HEAD_REF;
  }

  // for local development
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

function getBaseBranch() {
  // for github actions
  if (process.env.GITHUB_BASE_REF) {
    return `origin/${process.env.GITHUB_BASE_REF}`;
  }

  // for local development
  try {
    const defaultRef = execSync('git symbolic-ref refs/remotes/origin/HEAD', { encoding: 'utf8' }).trim();
    return defaultRef.replace('refs/remotes/', '');
  } catch {
    // fall through
  }

  return null;
}

// returns added, copied, modified, and renamed markdown files. (deleted files are not included).
function getChangedMarkdownFiles(baseBranch) {
  try {
    const diff = execSync(
      `git diff --name-only --diff-filter=ACMR ${baseBranch}...HEAD -- ":(glob)src/pages/**/*.md"`,
      { encoding: 'utf8' }
    ).trim();

    if (!diff) return [];
    return diff.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// returns deleted markdown files.
function getDeletedMarkdownFiles(baseBranch) {
  try {
    const diff = execSync(
      `git diff --name-only --diff-filter=D ${baseBranch}...HEAD -- ":(glob)src/pages/**/*.md"`,
      { encoding: 'utf8' }
    ).trim();

    if (!diff) return [];
    return diff.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

// example: src/pages/about/index.md -> about/
function fileToPagePath(file) {
  return file
    .replace(/^src\/pages/, '')
    .replace(/\.md$/, '')
    .replace(/\/index$/, '/');
}

// example: 2026-03-04T12:00:00Z -> 3/4/2026
function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function readExistingContributors() {
  try {
    const content = fs.readFileSync(CONTRIBUTORS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.data) ? parsed.data : [];
  } catch {
    return [];
  }
}

async function getFileContributors(owner, repo, filePath, headers, branch) {
  const encodedPath = encodeURIComponent(filePath);
  const branchParam = branch ? `&sha=${encodeURIComponent(branch)}` : '';

  // We only fetch the last 100 commits (one request, no pagination) to limit API rate
  // usage. We don't need every contributor — typically 3-20 is enough. 100 is a safe
  // upper bound that costs the same as fetching 20 (one request either way).
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?path=${encodedPath}&per_page=100${branchParam}`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    logStep(`Failed to fetch commits for ${filePath}`, `${response.status} ${response.statusText}`);
    return null;
  }

  const commits = await response.json();

  if (!Array.isArray(commits) || commits.length === 0) {
    return null;
  }

  const avatars = [...new Set(
    commits
      .map((c) => c.author?.avatar_url)
      .filter(Boolean)
  )];

  const lastUpdated = formatDate(commits[0]?.commit?.author?.date ?? null);

  return {
    avatars,
    lastUpdated,
  };
}

try {
  logSection('BUILD CONTRIBUTORS');
  logStep('Starting contributors build process');

  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    log('Could not determine repository info. Skipping contributors build.', 'warn');
    process.exit(0);
  }

  const { owner, repo } = repoInfo;
  logStep('Repository', `${owner}/${repo}`);

  const token = getToken();
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    logStep('No credentials found — attempting unauthenticated API calls');
    logStep('This works for public repos (60 req/hr limit)');
  }

  const branch = getCurrentBranch();
  if (branch) {
    logStep('Branch', branch);
    const branchCheckUrl = `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`;
    const branchCheckRes = await fetch(branchCheckUrl, { headers });
    if (!branchCheckRes.ok) {
      log(`Branch "${branch}" not found on GitHub (${branchCheckRes.status}). Contributors are fetched from the GitHub API using the current branch, so it must be pushed to the remote before running this script.`, 'warn');
      process.exit(0);
    }
  }

  let filesToProcess;
  let existingData = [];
  let deletedPaths = new Set();

  if (FULL_BUILD) {
    logStep('Mode', 'full build (--all)');
    filesToProcess = getMarkdownFiles(__dirname);
  } else {
    const baseBranch = getBaseBranch();

    if (!baseBranch) {
      logStep('Could not determine base branch — falling back to full build');
      filesToProcess = getMarkdownFiles(__dirname);
    } else {
      logStep('Base branch', baseBranch);

      const changedFiles = getChangedMarkdownFiles(baseBranch);
      const deletedFiles = getDeletedMarkdownFiles(baseBranch);
      deletedPaths = new Set(deletedFiles.map(fileToPagePath));
      existingData = readExistingContributors();

      if (existingData.length === 0) {
        logStep('No existing contributors.json — falling back to full build');
        filesToProcess = getMarkdownFiles(__dirname);
      } else if (changedFiles.length === 0 && deletedFiles.length === 0) {
        logStep('No markdown files changed — keeping existing contributors.json');
        process.exit(0);
      } else {
        logStep('Changed files', `${changedFiles.length}`);
        logStep('Deleted files', `${deletedFiles.length}`);
        logStep('Existing contributor entries', `${existingData.length}`);
        filesToProcess = changedFiles;
      }
    }
  }

  logStep('Files to process', `${filesToProcess.length}`);

  const newData = [];
  let apiFailed = false;

  for (const file of filesToProcess) {
    logStep('Processing', file);
    const result = await getFileContributors(owner, repo, file, headers, branch);

    if (!result) {
      if (!token) {
        apiFailed = true;
        break;
      }
      verbose(`No contributors found for ${file}`);
      continue;
    }

    const page = fileToPagePath(file);
    

    newData.push({
      page,
      ...result,
    });
  }

  if (apiFailed && newData.length === 0 && existingData.length === 0) {
    log('API calls failed (likely a private repo without credentials). Using existing contributors.json.', 'warn');
    process.exit(0);
  }

  const getEntryPage = (entry) => entry.page;
  const updatedPages = new Set(newData.map((entry) => entry.page));
  const mergedData = [
    ...existingData.filter((entry) => !updatedPages.has(getEntryPage(entry)) && !deletedPaths.has(getEntryPage(entry))),
    ...newData,
  ].sort((a, b) => (getEntryPage(a)).localeCompare(getEntryPage(b)));

  const contributors = {
    total: mergedData.length,
    offset: 0,
    limit: mergedData.length,
    data: mergedData,
    ':type': 'sheet',
  };

  verbose(`Writing contributors file to: ${CONTRIBUTORS_FILE_PATH}`);
  const contributorsContent = JSON.stringify(contributors);
  fs.writeFileSync(CONTRIBUTORS_FILE_PATH, contributorsContent);
  verbose(`Contributors file written successfully (${contributorsContent.length} characters)`);
  console.log(`Generated file: ${CONTRIBUTORS_FILE_PATH}`);

} catch (err) {
  if (err?.cause?.code === 'ENOTFOUND' || err?.message?.includes('fetch failed')) {
    log('Network error — could not reach GitHub API. Using existing contributors.json if available.', 'warn');
    process.exit(0);
  }
  log(`Contributors build failed: ${err.message}`, 'error');
  console.error(err);
  process.exit(1);
}
