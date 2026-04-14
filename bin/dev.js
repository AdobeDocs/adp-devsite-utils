// content/docs
// serve static on 3001

import express from 'express';
import path from 'path';
import { execSync } from 'child_process';

const __dirname = process.cwd();

const PORT = process.env.DEV_PORT || 3003;

const getCurrentBranch = () => {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Could not determine git branch, defaulting to "main"');
    return 'main';
  }
};

const buildSiteMetadata = () => {
  try {
    execSync('npm run buildSiteMetadata', { cwd: __dirname, stdio: 'inherit' });
  } catch (error) {
    console.warn('Failed to build site metadata:', error.message);
  }
};

const buildContributors = () => {
  try {
    execSync('npm run buildContributors', { cwd: __dirname, stdio: 'inherit' });
  } catch (error) {
    console.warn('Failed to build contributors:', error.message);
  }
};

const currentBranch = getCurrentBranch();
const DOCS_DIRECTORY = process.env.DIRECTORY ||  './src/pages';

buildContributors();
buildSiteMetadata();

const app = express();
console.log(path.resolve(__dirname, `./${DOCS_DIRECTORY}`));
app.use(
  express.static(path.resolve(__dirname, `./${DOCS_DIRECTORY}`), {
    setHeaders: (res, filePath, stat) => {
      res.setHeader('last-modified', stat.mtime.toGMTString());
      res.setHeader('local-branch-name', currentBranch);
    },
  }),
);

app.listen(PORT, () => {
  console.debug(`Docs dev server is running on port ${PORT}`);
});