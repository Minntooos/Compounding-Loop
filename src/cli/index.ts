import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { formatLaneCheck, runCheckLanes } from './checkLanes.js';
import { runDoctor } from './doctor.js';
import { runAddLanes } from './lanesInit.js';
import { parseLaneList } from '../core/lanesInit.js';
import { DEFAULT_PORT, runDashboard } from './dashboard.js';
import { realGh } from './gh.js';
import { runInit } from './init.js';
import { runAnswer, runNextRound, runStatus } from './loops.js';
import { runNew } from './new.js';
import { runRound } from './run.js';

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
  .option('--lanes <names>', 'also set up parallel lanes, e.g. --lanes core,web,docs (writes .ai/lanes.json and per-lane files)')
  .action(async (dir: string, options: { force?: boolean; dryRun?: boolean; lanes?: string }) => {
    const laneList = options.lanes === undefined ? undefined : parseLaneList(options.lanes);
    if (laneList?.error) {
      console.error(laneList.error);
      process.exitCode = 1;
      return;
    }
    const result = await runInit(path.resolve(dir), { force: Boolean(options.force), dryRun: Boolean(options.dryRun), ...(laneList && { skipTask: true }) });
    if (result.refused) {
      console.error(result.refused);
      process.exitCode = 1;
      return;
    }
    for (const action of result.actions) console.log(`${action.kind.padEnd(9)} ${action.dest}${action.reason ? `  (${action.reason})` : ''}`);
    if (result.missing.includes('method/operating-card.md')) console.error('warning: the Operating Card was NOT installed, so CLAUDE.md is unchanged.');
    for (const rel of result.missing) console.error(`warning: ${rel} is not in this package yet; used a built-in fallback or skipped it`);
    if (laneList) {
      try {
        const lanes = await runAddLanes(path.resolve(dir), laneList.names.map((name) => ({ name, owns: [`${name}/**`] })), { force: Boolean(options.force), dryRun: Boolean(options.dryRun), existingOk: true });
        for (const action of lanes.actions) console.log(`${action.kind.padEnd(9)} ${action.dest}${action.reason ? `  (${action.reason})` : ''}`);
        for (const rel of lanes.missing) console.error(`warning: ${rel} is not in this package yet; used a built-in fallback`);
        console.log('Each lane owns `<name>/**` for now: edit "owns" in .ai/lanes.json to match your folders, then run `loop check-lanes`.');
      } catch (error) {
        fail(error);
      }
    }
  });

const lanesCommand = program.command('lanes').description('Manage parallel lanes (see .ai/lanes.json)');
lanesCommand
  .command('add')
  .description('Add a lane that owns the given path globs, with its task file and outbox')
  .argument('<name>', 'lane name: lowercase letters, digits, dashes')
  .requiredOption('--owns <globs...>', 'path globs this lane owns, e.g. --owns "src/api/**" "tests/api/**"')
  .option('--cron <cron>', 'cron expression for the lane (default: next staggered hourly minute)')
  .option('--dir <dir>', 'repo folder', '.')
  .option('--dry-run', 'show what would be written without writing')
  .action(async (name: string, options: { owns: string[]; cron?: string; dir: string; dryRun?: boolean }) => {
    try {
      const parsed = parseLaneList(name);
      if (parsed.error || parsed.names.length !== 1) throw new Error(parsed.error ?? 'Add one lane at a time.');
      const lanes = await runAddLanes(path.resolve(options.dir), [{ name, owns: options.owns, ...(options.cron && { cron: options.cron }) }], { force: false, dryRun: Boolean(options.dryRun) });
      for (const action of lanes.actions) console.log(`${action.kind.padEnd(9)} ${action.dest}${action.reason ? `  (${action.reason})` : ''}`);
      for (const rel of lanes.missing) console.error(`warning: ${rel} is not in this package yet; used a built-in fallback`);
    } catch (error) {
      fail(error);
    }
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

const fail = (error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
};

program
  .command('status')
  .description('Fleet table for one or more loop folders')
  .argument('[dirs...]', 'loop folders', ['.'])
  .action(async (dirs: string[]) => {
    try {
      console.log(await runStatus(dirs.map((d) => path.resolve(d))));
    } catch (error) {
      fail(error);
    }
  });

program
  .command('next-round')
  .description('After DONE.md: archive it as .ai/done-vN.md and write the next round\'s task.md from its "next 10" list')
  .argument('[dir]', 'loop folder', '.')
  .option('--dry-run', 'report what would happen without writing')
  .action(async (dir: string, options: { dryRun?: boolean }) => {
    try {
      const result = await runNextRound(path.resolve(dir), { dryRun: Boolean(options.dryRun) });
      console.log(`${options.dryRun ? 'Would archive' : 'Archived'} DONE.md as .ai/${result.archivedAs}; next round has ${result.units} units.`);
    } catch (error) {
      fail(error);
    }
  });

program
  .command('answer')
  .description('Answer a BLOCKED.md: record the answer, remove the file, commit')
  .argument('[answer]', 'your answer; omit with --accept to take the agent\'s best guess')
  .option('--accept', 'accept the best guess in BLOCKED.md')
  .option('--dir <dir>', 'loop folder', '.')
  .option('--push', 'push the commit so the loop restarts without another step')
  .option('--dry-run', 'show the question and answer without writing')
  .action(async (answer: string | undefined, options: { accept?: boolean; dir: string; dryRun?: boolean; push?: boolean }) => {
    try {
      if (!options.accept && !answer) throw new Error('Pass an answer, or --accept to take the best guess.');
      const result = await runAnswer(path.resolve(options.dir), options.accept ? 'accept' : (answer ?? ''), { dryRun: Boolean(options.dryRun), push: Boolean(options.push) });
      const ending = options.dryRun ? '\n(dry run: nothing written)' : result.pushed ? '\nCommitted and pushed. The loop restarts on its next run.' : result.pushed === false ? `\nCommitted, but the push failed: ${result.pushError}\nFix that (for a rejected push: \`git pull --rebase && git push\`) to restart the loop.` : '\nCommitted. Push (or use --push next time) to restart the loop.';
      console.log(`Question: ${result.question}\nAnswer:   ${result.answer}${ending}`);
      if (result.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('run')
  .description('Run one build round now with Claude Code, using the same prompt the scheduler uses')
  .argument('[dir]', 'loop folder', '.')
  .option('--dry-run', 'print the prompt and stop; never starts claude')
  .option('--skip-permissions', 'pass --dangerously-skip-permissions to claude (you accept the risk)')
  .option('--model <model>', 'model for this round')
  .option('--lane <name>', 'run as this lane from .ai/lanes.json (own task file, outbox and session lock)')
  .action(async (dir: string, options: { dryRun?: boolean; skipPermissions?: boolean; model?: string; lane?: string }) => {
    try {
      const result = await runRound(path.resolve(dir), {
        dryRun: Boolean(options.dryRun), skipPermissions: Boolean(options.skipPermissions), ...(options.model && { model: options.model }),
        ...(options.lane && { lane: options.lane }),
      });
      if (result.skipped) console.log(result.skipped);
      else if (options.dryRun) console.log(`Prompt from ${result.source}:\n\n${result.prompt}`);
      if (result.exitCode) process.exitCode = result.exitCode;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('dashboard')
  .description('Start the local dashboard and open it in your browser')
  .option('--demo', 'show the built-in snapshot of five real loops')
  .option('--port <port>', 'port to listen on', String(DEFAULT_PORT))
  .option('--no-open', 'do not open the browser')
  .option('--projects <dir>', 'folder that holds your loops', '.')
  .action(async (options: { demo?: boolean; port: string; open: boolean; projects: string }) => {
    try {
      const server = await runDashboard({ demo: Boolean(options.demo), port: Number(options.port), open: options.open, projectsDir: options.projects });
      for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => void Promise.resolve(server.close()).finally(() => process.exit(0)));
      // The server keeps the process alive; Ctrl+C stops it.
    } catch (error) {
      fail(error);
    }
  });

program
  .command('check-lanes')
  .description('Fail if a commit with a "Lane: <name>" trailer touched files outside its lane (see .ai/lanes.json)')
  .argument('[dir]', 'repo folder', '.')
  .option('--range <range>', 'commits to check, e.g. origin/main..HEAD (default: the last 50)')
  .action(async (dir: string, options: { range?: string }) => {
    try {
      const result = await runCheckLanes(path.resolve(dir), options.range);
      console.log(formatLaneCheck(result));
      if (result.problems.length > 0) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('doctor')
  .description('Check that node, git, gh, claude and Playwright Chromium are installed, and say how to fix what is not')
  .action(async () => {
    try {
      const { report, passed } = await runDoctor();
      console.log(report);
      if (!passed) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

await program.parseAsync();
