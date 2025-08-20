import {remark} from 'remark'
import remarkLintListItemIndent from 'remark-lint-list-item-indent'
import remarkPresetLintConsistent from 'remark-preset-lint-consistent'
import remarkPresetLintRecommended from 'remark-preset-lint-recommended'
import { fileURLToPath } from 'url';
import path from 'path';

const { log, verbose, logSection, logStep } = await import('./scriptUtils.js');

// Get the directory where this script is located (adp-devsite-utils repo)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const adpDevsiteUtilsDir = path.dirname(__dirname);

const file = await remark()
  // Check that markdown is consistent.
  .use(remarkPresetLintConsistent)
  // Few recommended rules.
  .use(remarkPresetLintRecommended)
  // `remark-lint-list-item-indent` is configured with `one` in the
  // recommended preset, but if we’d prefer something else, it can be
  // reconfigured:
  .use(remarkLintListItemIndent, 'tab')
  .process('1) Hello, _Jupiter_ and *Neptune*!')

