# Adobe Developer Documentation

Documentation site deployed to EDS.
The production address is `https://developer.adobe.com/<pathPrefix>/`

## Quick Start

For local development, you need to start three servers:

1. **Content server** (your content repo):
```bash
npm run dev
```

2. **Code server** ([adp-devsite](https://github.com/AdobeDocs/adp-devsite)):
```bash
git clone https://github.com/AdobeDocs/adp-devsite
cd adp-devsite
npm install
npm run dev
```

3. **Runtime connector** ([devsite-runtime-connector](https://github.com/aemsites/devsite-runtime-connector)):
```bash
git clone https://github.com/aemsites/devsite-runtime-connector
cd devsite-runtime-connector
npm install
npm run dev
```

Once all three servers are running, navigate to `http://localhost:3000/<pathPrefix>`

## Commands

**Development**
- `npm run dev` - Start local server (requires other services above)

**Content Management**
- `npm run buildNavigation` - Generate navigation structure (one-time Gatsby migration only).  This will generate config.md which is a replacement of gatsby-config.js.
  
  ⚠️ **WARNING**: This will overwrite any manual edits to `src/pages/config.md`. Only run during initial setup.

- `npm run buildRedirections` - Build URL redirections (one-time Gatsby migration only). This generates client-side redirects to support EDS behavior with URLs (trailing slashes).
  
  ⚠️ **WARNING**: This will overwrite any manual edits to `src/pages/redirects.json`. Only run during initial setup.
  
  📝 **Note**: This creates client-side redirects only. For server-side redirects (Fastly), please reach out to the devsite team.

- `npm run normalizeLinks` - Normalize internal/external links
- `npm run renameFiles` - Rename files to Adobe conventions. Make sure run normalizeLinks first to ensure the links get renamed.

**Validation**
- `npm run lint` - Run linting checks (also runs automatically on PRs to main and during deploy)

**Site Features**
- `npm run buildSiteWideBanner` - Generate site-wide banner

## Linting

**Automated**: Runs on PRs and deploy when `src/pages/**` files change
**Manual**: `npm run lint`

Validates markdown syntax, links, content structure, and Adobe style guidelines.

### Running from Another Repo

You can run the linter from any other repo using npx:

```bash
# Run all linting rules (errors and summary only)
npx --yes github:AdobeDocs/adp-devsite-utils runLint

# Run with verbose output (shows all files processed and details)
npx --yes github:AdobeDocs/adp-devsite-utils runLint -v

# Run all linting rules EXCEPT dead links (faster)
npx --yes github:AdobeDocs/adp-devsite-utils runLint --skip-dead-links

# Check only for dead external links
npx --yes github:AdobeDocs/adp-devsite-utils runLint --dead-links-only

```

**Options:**
- `-v` or `--verbose` - Show detailed output including all files processed
- `--dead-links-only` - Only check for dead external URLs (skips all other linting rules)
- `--skip-dead-links` - Run all linting rules EXCEPT dead links check (faster)

**Troubleshooting**: If pages are not showing up as expected, check lint errors or warnings to identify potential issues.

## Navigation

To update navigation structure:
1. Edit `src/pages/config.md` directly

*Note: `npm run buildNavigation` is only needed for initial Gatsby migration.*  The config.md is a replacement of gatsby-config.js.
⚠️ **WARNING**: This will overwrite any manual edits to `src/pages/config.md`. Only run during initial setup.


## Fastly Redirects Script

The `fastlyRedirects.js` script manages redirect rules in Fastly CDN by reading redirects from a `redirects.json` file and uploading them to a Fastly edge dictionary.

### Prerequisites

#### 1. Environment Variables

You need to set these environment variables (set in the `.env` file) and in the content repo's folder at the root:

```bash
# Required for all operations
FASTLY_API_TOKEN=your_fastly_api_token

# For stage environment
FASTLY_DEVELOPER_STAGE_ADOBE_COM_SERVICE_ID=your_stage_service_id
FASTLY_DEVELOPER_STAGE_ADOBE_COM_INT_TO_INT_TABLE_ID=your_stage_dictionary_id

# For prod environment
FASTLY_DEVELOPER_ADOBE_COM_SERVICE_ID=your_prod_service_id
FASTLY_DEVELOPER_ADOBE_COM_INT_TO_INT_TABLE_ID=your_prod_dictionary_id
```

#### 2. Redirects File

Create a `redirects.json` file using the `buildRedirections.js` script. `buildRedirections.js` should be called after using `normalizeLinks.js`, then `buildNavigation.js` so the `buildRedirections.js` will output the most up to date `redirects.json` file. It will generate a file with this format:

```json
{
  "data": [
    {
      "Source": "/old-path",
      "Destination": "/new-path"
    },
    {
      "Source": "/another-old-path",
      "Destination": "/another-new-path"
    }
  ]
}
```

### Usage

#### Basic Command

```bash
node bin/fastlyRedirects.js [environment] [flags]
```

From the content repo:
```bash
npx --yes github:AdobeDocs/adp-devsite-utils fastlyRedirects [environment] [flags]
```

#### Arguments

**Environment** (positional, optional):
- `stage` - Updates stage environment (default if not specified)
- `prod` - Updates production environment

**Flags** (optional):
- `--dry-run` or `-d` - Preview changes without making actual API calls
- `--verbose` or `-v` - Show detailed output including API requests/responses

#### Examples

1. **Test in stage with dry run** (recommended first step):
   ```bash
   node bin/fastlyRedirects.js stage --dry-run --verbose
   ```

2. **Update stage environment**:
   ```bash
   node bin/fastlyRedirects.js stage
   ```

3. **Update production environment** (use with caution):
   ```bash
   node bin/fastlyRedirects.js prod
   ```

4. **Preview production changes without applying**:
   ```bash
   node bin/fastlyRedirects.js prod --dry-run
   ```

4. **Test in content repo with stage and with a dry run**:
   ```bash
   npx --yes github:AdobeDocs/adp-devsite-utils fastlyRedirects stage --dry-run --verbose
   ```

### How It Works

1. Loads the `redirects.json` file from the current working directory
2. Validates the redirect structure
3. For each redirect, makes a POST request to Fastly's API to add the redirect to the dictionary
4. The redirects are stored as key-value pairs (Source → Destination) in the Fastly edge dictionary

### Tips

- Always test with `--dry-run` first to preview changes
- Use `--verbose` to troubleshoot issues
- The script defaults to `stage` environment for safety
- Each redirect becomes a dictionary item in Fastly that can be used for URL rewriting at the edge

## Deployment

**Staging**:
- Actions > Deployment > Run workflow
- Can deploy from any branch to staging
- Uses incremental builds from last successful workflow deploy on the current branch by default. Will use the commit before HEAD if no successful workflow deploy found
- Use `deployAll` function for full rebuild if needed
- **URL**: `developer-stage.adobe.com/<pathPrefix>/`

**Production**:
- Automatically deploys from `main` branch
- Uses incremental builds from last successful workflow deploy
- **URL**: `developer.adobe.com/<pathPrefix>/`

## AI Metadata Generation

**This feature is in the testing stage please contact the DevSite team if you'd like to use it or need support**

**Initial Generation for all files**:
*Processes all markdown files in the specified folder to generate comprehensive AI metadata. Creates a pull request with the generated metadata added to frontmatter of each file. The generated metadata can be edited/changed or deleted entirely in the branch the action created.*

- Actions > Initial AI Generation > set inputs > Run workflow
  - Use worfklow from: Set as `main`
  - Target branch: will send ai generated metadata as changes in a PR to whatever branch you set - default is `main`
  - Folder path: set to read ALL files in a folder path or only some - default is `src/pages/*`

**Nightly Refresh for changed files**:
*Identifies files that have changed since a specific commit and generates updated AI metadata only for those files. Useful for keeping metadata current without processing unchanged content. Creates a pull request with the generated metadata added to frontmatter of each file. The generated metadata can be edited/changed or deleted entirely in the branch the action created.*

- Actions > Nightly AI Metadata Refresh > set inputs > Run workflow
  - Use workflow from: Set as `main`
  - Base SHA: Use base SHA commit to compare changes from (leave empty to use last commit before HEAD)
  - Target branch: will send ai generated metadata as changes in a PR to whatever branch you set - default is `main`
  - Folder path: set to read ALL files in a folder path or only some - default is `src/pages/*`
  - **Note**: This workflow also runs automatically every night at 2 AM UTC to process recently changed files

**Generation on Pull Requests for changed files**:
*Automatically analyzes files changed in pull requests and generates AI metadata suggestions. Adds a comment to the PR with proposed metadata updates that can be reviewed and applied.*

- Runs automatically when PRs are created/updated to merge to `main` with changes to files in `src/pages/**`
- Generates AI metadata for files changed in the PR
- **Note**: Skips PRs with titles starting with "[AI PR] Metadata Update" or branch names starting with "ai-metadata" to avoid loops

**Note**: will only read valid files (skips images and binary files) and right now will skip files with JSX components but we are working on fixing that. These workflows are only for EDS repos.

## Support

Join `#adobe-developer-website` Slack channel for help.

