import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { realGh } from './gh.js';
import { runInit } from './init.js';
import { runNew } from './new.js';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

// Commands are added by the core lane: init, new, run, status, next-round, answer, dashboard.
export const program = new Command('loop')
  .description('Unattended, verified Claude Code build loops. Write the brief, check back tomorrow.')
  .version(pkg.version);

program
  .command('init')
  .description('Add the Compounding Loop method to a repo (idempotent; never overwrites without --force)')
  .argument('[dir]', 'target repo folder', '.')
  .option('--force', 'skip the brief check and overwrite existing kit files')
  .option('--dry-run', 'show what would be written without writing')
  .action(async (dir: string, options: { force?: boolean; dryRun?: boolean }) => {
    const result = await runInit(path.resolve(dir), { force: Boolean(options.force), dryRun: Boolean(options.dryRun) });
    if (result.refused) {
      console.error(result.refused);
      process.exitCode = 1;
      return;
    }
    for (const action of result.actions) console.log(`${action.kind.padEnd(9)} ${action.dest}${action.reason ? `  (${action.reason})` : ''}`);
    if (result.missing.includes('method/operating-card.md')) console.error('warning: the Operating Card was NOT installed, so CLAUDE.md is unchanged.');
    for (const rel of result.missing) console.error(`warning: ${rel} is not in this package yet; used a built-in fallback or skipped it`);
  });

program
  .command('new')
  .description('Create a new loop repo from a template (private GitHub repo unless --dry-run)')
  .argument('<template>', 'template name, e.g. static-site')
  .argument('[name]', 'folder and repo name (defaults to the template name)')
  .option('--dry-run', 'write the folder locally and never touch GitHub')
  .option('--public', 'create the GitHub repo as public (default: private)')
  .action(async (template: string, name: string | undefined, options: { dryRun?: boolean; public?: boolean }) => {
    try {
      const result = await runNew(template, name ?? template, {
        parentDir: process.cwd(), dryRun: Boolean(options.dryRun), publicRepo: Boolean(options.public), gh: realGh,
      });
      console.log(`Created ${result.dir}${result.repoUrl ? `\nGitHub: ${result.repoUrl}` : ''}`);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });

await program.parseAsync();
