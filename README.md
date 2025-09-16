# Adobe Developer Documentation

Documentation site deployed to EDS.
The production address is https://developer.adobe.com/<pathPrefix>/

## Quick Start

For local development, you need to start three servers:

1. **Content server** (this repo):
```bash
npm run dev
```

2. **ADP Devsite** ([adp-devsite](https://github.com/AdobeDocs/adp-devsite)):
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

Once all three servers are running, navigate to http://localhost:3000/<pathPrefix>

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

**Troubleshooting**: If pages are not showing up as expected, check lint errors or warnings to identify potential issues.

## Navigation

To update navigation structure:
1. Edit `src/pages/config.md` directly

*Note: `npm run buildNavigation` is only needed for initial Gatsby migration.*  The config.md is a replacement of gatsby-config.js.
⚠️ **WARNING**: This will overwrite any manual edits to `src/pages/config.md`. Only run during initial setup.

## Redirects

To manage URL redirections:
1. Edit `src/pages/redirects.json` directly

*Note: `npm run buildRedirections` is only needed for initial Gatsby migration. This generates client-side redirects to support Gatsby behavior with URLs (trailing slashes).*  

⚠️ **WARNING**: This will overwrite any manual edits to `src/pages/redirects.json`. Only run during initial setup.

📝 **Note**: This creates client-side redirects only. For server-side redirects (Fastly), please reach out to the devsite team.

## Deployment

**Staging**:
- Actions > Deployment > Run workflow
- Can deploy from any branch to staging
- Uses incremental builds from last commit by default
- Use `deployAll` function for full rebuild if needed
- **URL**: `developer-stage.adobe.com/<pathPrefix>/`

**Production**:
- Automatically deploys from `main` branch
- Uses incremental builds from last commit
- **URL**: `developer.adobe.com/<pathPrefix>/`

## AI Metadata and FAQ Generation

**Initial Generation for all files**:
*Processes all markdown files in the specified folder to generate comprehensive AI metadata and FAQs. Creates a pull request with the generated metadata added to frontmatter of each file. The generated metadata can be edited/changed or deleted entirely in the branch the action created.*

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

