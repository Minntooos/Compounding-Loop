import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInit } from './init.js';

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
    for (const rel of result.missing) console.log(`note: ${rel} is not in this package yet; used a built-in fallback or skipped it`);
  });

await program.parseAsync();
