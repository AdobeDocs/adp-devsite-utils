#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = process.cwd();
const REMARK_CONFIG_DIR = path.join(ROOT_DIR, '.github/linters');
const REMARK_CONFIG_FILE = 'remarkrc.yml';
const UTILS_LINTERS_DIR = path.join(__dirname, '../linters');
const REQUIRED_DEPS = [
  'remark@^15.0.1',
  'remark-cli@^12.0.1', 
  'remark-lint@^10.0.1',
  'remark-heading-id@^1.0.1', 
  'remark-validate-links@^13.0.1', 
  'remark-lint-no-multiple-toplevel-headings@^3.1.0',
];

async function lintRemark() {
  try {
    // 1. Ensure remark config file exists
    await ensureRemarkConfig();
    
    // 2. Ensure linters files exist
    await ensureLinters();
    
    // 3. Check and install dependencies if needed
    await ensureDependencies();
    
    // 4. Run the lint command
    await runLint();
    
  } catch (error) {
    console.error('Error running lint:warnings:', error.message);
    process.exit(1);
  }
}

async function ensureRemarkConfig() {
  const configPath = path.join(REMARK_CONFIG_DIR, REMARK_CONFIG_FILE);
  
  if (!fs.existsSync(configPath)) {
    console.log(`Creating ${REMARK_CONFIG_FILE}...`);
    const configContent = `plugins:
  - remark-heading-id
  - remark-validate-links
  - remark-lint-no-multiple-toplevel-headings
  // - ./remark-lint-check-frontmatter.js
  // - ./remark-lint-no-angle-brackets.js
  // - ./remark-lint-self-close-component.js
`;
    fs.writeFileSync(configPath, configContent);
  }
}

async function ensureLinters() {
  console.log('Copying linters to .github/linters...');
  
  // Ensure the target directory exists
  if (!fs.existsSync(REMARK_CONFIG_DIR)) {
    fs.mkdirSync(REMARK_CONFIG_DIR, { recursive: true });
  }
  
  // Read the linters directory from adp-devsite-utils
  if (!fs.existsSync(UTILS_LINTERS_DIR)) {
    throw new Error(`Linters directory not found at ${UTILS_LINTERS_DIR}`);
  }
  
  const linterFiles = fs.readdirSync(UTILS_LINTERS_DIR);
  
  linterFiles.forEach(file => {
    if (file.endsWith('.js')) {
      const sourcePath = path.join(UTILS_LINTERS_DIR, file);
      const targetPath = path.join(REMARK_CONFIG_DIR, file);
      
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`  Copied ${file}`);
    }
  });
}

async function ensureDependencies() {
  const packageJsonPath = path.join(ROOT_DIR, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found in target directory');
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const devDeps = packageJson.devDependencies || {};
  
  const missingDeps = REQUIRED_DEPS.filter(dep => {
    const [name] = dep.split('@');
    return !devDeps[name];
  });
  
  if (missingDeps.length > 0) {
    console.log('Installing missing dependencies:', missingDeps.join(', '));
    
    try {
      // Try yarn first, fallback to npm
      execSync(`yarn add -D ${missingDeps.join(' ')}`, { stdio: 'inherit', cwd: ROOT_DIR });
    } catch (yarnError) {
      try {
        execSync(`npm install --save-dev ${missingDeps.join(' ')}`, { stdio: 'inherit', cwd: ROOT_DIR });
      } catch (npmError) {
        throw new Error('Failed to install dependencies with both yarn and npm');
      }
    }
  }
}

async function runLint() {
  console.log('Running lint...');
  
  try {
    // Try npx (works with both yarn and npm)
    execSync(`npx remark src/pages --quiet --rc-path ${path.join(REMARK_CONFIG_DIR, REMARK_CONFIG_FILE)}`, { 
      stdio: 'inherit',
      cwd: ROOT_DIR 
    });
  } catch (error) {
    // Exit with the same code as the lint command
    process.exit(error.status || 1);
  }
}

lintRemark();