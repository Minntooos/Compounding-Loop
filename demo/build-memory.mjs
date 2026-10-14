// Builds demo/memory.json: the Round 6 fixtures for the Knowledge & recipes and Eval screens.
// Knowledge for this repo mirrors its two real entries; the recipes mirror the seeds kit ships.
// The eval numbers are INVENTED sample data (`sample: true`): the owner's real run replaces them.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const calculatorRecipe = {
  id: 'R-static-calculator-site',
  title: 'Static calculator site (Vite or plain HTML)',
  kind: 'project',
  stack: ['node@20', 'playwright@1', 'vite@5'],
  tags: ['calculator', 'static', 'seo'],
  status: 'CONFIRMED',
  uses: 5,
  passes: 5,
  steps: 7,
  checks: 4,
  bytes: 3120,
  store: 'user',
  path: '~/.ai/recipes/static-calculator-site.md',
};
const cliRecipe = {
  id: 'R-cli-command-json',
  title: 'Add a CLI subcommand with --json',
  kind: 'feature',
  stack: ['node@20', 'vitest@2', 'typescript@5'],
  tags: ['cli', 'json', 'tests'],
  status: 'CONFIRMED',
  uses: 3,
  passes: 2,
  steps: 6,
  checks: 3,
  bytes: 2480,
  store: 'project',
  path: '.ai/recipes/cli-command-json.md',
};

const empty = { entries: [], triggers: [], recipes: [] };
const sites = Object.fromEntries(
  ['proj1', 'proj2', 'proj3', 'proj4', 'proj5'].map((id) => [id, { ...empty, recipes: [{ ...calculatorRecipe, match: { score: 2, reason: 'stack 2/3, tags: calculator, static' } }] }]),
);

export const memory = {
  knowledge: {
    ...sites,
    'compounding-loop': {
      entries: [
        { id: 'K-0001', title: 'Hono app.request() has no Host header (403 from the loopback guard)', status: 'confirmed', fired: 4, triggerIds: ['K-0001'] },
        { id: 'K-0002', title: 'Windows: Vitest runner not found, EBUSY at cleanup, git-heavy test timeouts', status: 'confirmed', fired: 9, triggerIds: ['K-0002', 'K-0002-ebusy'] },
        { id: 'K-0003', title: 'Playwright "Response has been disposed" is a flaky route, not a product bug', status: 'guess', fired: 0, triggerIds: [] },
      ],
      triggers: [
        { id: 'K-0001', kinds: ['error'], fired: 4, entry: 'K-0001' },
        { id: 'K-0002', kinds: ['error'], fired: 6, entry: 'K-0002' },
        { id: 'K-0002-ebusy', kinds: ['file'], fired: 3, entry: 'K-0002' },
      ],
      recipes: [{ ...cliRecipe, match: { score: 3, reason: 'stack 3/3' } }, { ...calculatorRecipe, match: { score: 1, reason: 'stack 1/3, major differs: vite' } }],
    },
  },
  recipes: { recipes: [calculatorRecipe, cliRecipe] },
  eval: {
    sample: true,
    command: 'loop eval run --task calc-page --arm both',
    headline: 'haiku: 3/3 with a recipe vs 1/3 cold, 58% fewer tokens (sample data)',
    rows: [
      { task: 'calc-page', arm: 'cold', model: 'haiku', runs: 3, passed: 1, medianTokens: 96000, medianSeconds: 410, medianTurns: 24 },
      { task: 'calc-page', arm: 'recipe', model: 'haiku', runs: 3, passed: 3, medianTokens: 40500, medianSeconds: 190, medianTurns: 11 },
      { task: 'cli-json', arm: 'cold', model: 'haiku', runs: 3, passed: 2, medianTokens: 70200, medianSeconds: 300, medianTurns: 18 },
      { task: 'cli-json', arm: 'recipe', model: 'haiku', runs: 3, passed: 3, medianTokens: 31000, medianSeconds: 140, medianTurns: 9 },
      { task: 'known-trap', arm: 'cold', model: 'haiku', runs: 3, passed: 0, medianTokens: 88000, medianSeconds: 380, medianTurns: 26 },
      { task: 'known-trap', arm: 'recipe+triggers', model: 'haiku', runs: 3, passed: 2, medianTokens: 36000, medianSeconds: 170, medianTurns: 10 },
    ],
  },
};

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'memory.json');
if (process.argv[1] === fileURLToPath(import.meta.url)) await writeFile(out, `${JSON.stringify(memory, null, 2)}\n`);
