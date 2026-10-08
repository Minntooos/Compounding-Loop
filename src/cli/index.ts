import { Command } from 'commander';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

// Commands are added by the core lane: init, new, run, status, next-round, answer, dashboard.
export const program = new Command('loop')
  .description('Unattended, verified Claude Code build loops. Write the brief, check back tomorrow.')
  .version(pkg.version);

program.parse();
