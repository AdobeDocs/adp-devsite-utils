# Adobe Developer Documentation

Documentation site deployed to EDS.
The production address is `https://developer.adobe.com/<pathPrefix>/`

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

## Support

Join `#adobe-developer-website` Slack channel for help.

