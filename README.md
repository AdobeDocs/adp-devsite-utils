# Adobe Connect SDK Documentation

Adobe Connect SDK documentation site deployed to EDS.
The production address is https://developer.adobe.com/<pathPrefix>/

## Quick Start

For local development, you need to start three servers:

1. **Main dev server** (this repo):
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
- `npm run buildNavigation` - Generate navigation structure (one-time Gatsby migration only)
- `npm run buildRedirections` - Build URL redirections (one-time Gatsby migration only)
- `npm run renameFiles` - Rename files to Adobe conventions
- `npm run normalizeLinks` - Normalize internal/external links

**Validation**
- `npm run lint` - Run linting checks

**Site Features**
- `npm run buildSiteWideBanner` - Generate site-wide banner

*All commands use `@AdobeDocs/adp-devsite-utils` for standardized tooling.*

## Linting

**Automated**: Runs on PRs when `src/pages/**` files change
**Manual**: `npm run lint`

Validates markdown syntax, links, content structure, and Adobe style guidelines.

**Troubleshooting**: If pages are not showing up as expected, check lint warnings to identify potential issues.

## Navigation

To update navigation structure:
1. Edit `src/pages/config.md` directly

*Note: `npm run buildNavigation` is only needed for initial Gatsby migration.*

## Redirects

To manage URL redirections:
1. Edit `src/pages/redirects.json` directly

*Note: `npm run buildRedirections` is only needed for initial Gatsby migration.*

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

## Blocks

### AccordionItem Block

The AccordionItem block creates collapsible content sections that can contain headings, tables, text, and code blocks. It uses + and - icons to indicate expand/collapse states.

![accordion_block_closed](/docs/images/accordionitem-closedstate.png)

![accordion_block_open](/docs/images/accordionitem-openstate.png)

```
<AccordionItem slots="heading, table, text, code"/>

### 4. Track buffer end

| Number | Action | Client Request |
| --- | --- | --- |
| 4 | Buffer ends | `/play?configId=<ID>` |

Description text here.

```json
{
  "eventType": "media.play"
}
```

Use `slots` to identify the markdown content:
- `heading`
- `table`
- `text`
- `code`

### Announcement Block

The Announcement Block goes directly underneath the Hero Block for pages.
It's used to call out new features, blog posts, news etc. anything that needs that needs to be surfaced above the fold.

![announcement block](/docs/images/announcement-block.png)

<Announcement slots="heading, text, button" variant="primary" backgroundColor="background-color-gray" />

### Are you an existing developer?

Action required: Add trader details to continue EU distribution.

- [Add trader details now.](https://new.express.adobe.com/add-ons?mode=submission)

Use `slots` to identify the markdown content:

- `heading`
- `button`
- `text`

Use `variant` to match the color of the button. Defaults to `primary`.

- `primary` or `secondary`
