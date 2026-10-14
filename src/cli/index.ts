import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runClaim, runRelease, type ClaimResult } from './claim.js';
import { runNext } from './next.js';
import { formatNext } from '../core/next.js';
import { formatLaneCheck, runCheckLanes } from './checkLanes.js';
import { runDoctor } from './doctor.js';
import { runAddLanes } from './lanesInit.js';
import { parseLaneList } from '../core/lanesInit.js';
import { DEFAULT_PORT, runDashboard } from './dashboard.js';
import { realGh } from './gh.js';
import { runInit } from './init.js';
import { runAnswer, runNextRound, runStatus } from './loops.js';
import { formatLaneRound, runLaneRound } from './laneRound.js';
import { runNew } from './new.js';
import { formatShipCheck, runShipCheck } from './shipCheck.js';
import { formatRuns, logRun, readRuns } from './runs.js';
import { runPause, runResume, type PauseResult } from './pause.js';
import { runRound } from './run.js';
import { runDraft } from './draft.js';
import { formatTriggersReport, runHook, triggersStats } from './hook.js';
import { runRecipeDraft } from './recipeDraft.js';
import { addRecipe, checkRecipes, formatMatches, formatRecipeList, listRecipes, matchHere, showRecipe } from './recipe.js';
import { formatPaceReport, runPaceSet, runPaceShow } from './pace.js';
import { formatScheduleReport, runScheduleAction, runScheduleShow, runScheduleUpdate, runSteer, type ScheduleAction, type ScheduleResult } from './schedule.js';

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
  .description('After DONE.md: archive it as .ai/done-vN.md and write the next round\'s task.md from its "next 10" list. With --brief in a laned repo: put the brief first in IDEA.md, archive every DONE.md, reset each lane\'s task file')
  .argument('[dir]', 'loop folder', '.')
  .option('--dry-run', 'report what would happen without writing')
  .option('--brief <file>', 'laned repos: the next round\'s brief (scored first)')
  .option('--no-commit', 'with --brief: write the changes but do not commit')
  .option('--json', 'with --brief: print the plan as JSON (shape: RoundPlan in src/core/laneRound.ts)')
  .option('--draft', 'ask Claude (claude -p) to draft the next brief from the DONE.md lists, open audit findings and steering; writes it and prints its score')
  .option('--out <file>', 'with --draft: where the draft goes (default .ai/next-round.draft.md)')
  .option('--print-prompt', 'with --draft: print the prompt only, to paste into Claude Code yourself')
  .option('--model <model>', 'with --draft: the Claude model to use')
  .action(async (dir: string, options: { dryRun?: boolean; brief?: string; commit: boolean; json?: boolean; draft?: boolean; out?: string; printPrompt?: boolean; model?: string }) => {
    try {
      if (options.draft || options.printPrompt) {
        const r = await runDraft(path.resolve(dir), { ...(options.printPrompt && { printPrompt: true }), ...(options.out && { out: options.out }), ...(options.model && { model: options.model }) });
        if (!r.draft) console.log(r.prompt);
        else console.log(`Draft written to ${path.relative(process.cwd(), r.outFile as string) || r.outFile}. Brief score ${r.lint?.score}/100${r.lint?.gaps.length ? `; missing: ${r.lint.gaps.map((g) => g.message).join(' ')}` : ''}\nReview it, then: loop next-round --brief ${options.out ?? '.ai/next-round.draft.md'}`);
        return;
      }
      if (options.brief) {
        const result = await runLaneRound(path.resolve(dir), { briefFile: options.brief, dryRun: Boolean(options.dryRun), commit: options.commit });
        console.log(options.json ? JSON.stringify(result, null, 2) : formatLaneRound(result, Boolean(options.dryRun)));
        return;
      }
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
  .option('--as <name>', 'your name for lane claims: a claim by this name does not stop the run')
  .action(async (dir: string, options: { dryRun?: boolean; skipPermissions?: boolean; model?: string; lane?: string; as?: string }) => {
    try {
      const result = await runRound(path.resolve(dir), {
        dryRun: Boolean(options.dryRun), skipPermissions: Boolean(options.skipPermissions), ...(options.model && { model: options.model }),
        ...(options.lane && { lane: options.lane }),
        ...(options.as && { as: options.as }),
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

const pushNote = (r: ClaimResult) => (r.pushed === false ? `\nCommitted, but the push failed: ${r.pushError}\nFix that (for a rejected push: \`git pull --rebase && git push\`) so teammates see it.` : '');

program
  .command('claim')
  .description('Tell teammates you are working a lane: writes .ai/lanes/<lane>/claim, commits and pushes it')
  .argument('<lane>', 'lane name from .ai/lanes.json')
  .option('--as <name>', 'your name (default: git config user.name)')
  .option('--minutes <n>', 'how long the claim lasts', '90')
  .option('--force', 'take over a lane someone else has claimed')
  .option('--no-push', 'commit but do not push')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (lane: string, options: { as?: string; minutes: string; force?: boolean; push: boolean; dir: string }) => {
    try {
      const r = await runClaim(path.resolve(options.dir), lane, { ...(options.as && { as: options.as }), minutes: Number(options.minutes), force: Boolean(options.force), push: options.push });
      console.log(`Claimed ${r.lane} as ${r.name} until ${r.expiresAt?.toISOString()}.${pushNote(r)}`);
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('release')
  .description('Remove your claim on a lane (commits and pushes)')
  .argument('<lane>', 'lane name from .ai/lanes.json')
  .option('--no-push', 'commit but do not push')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (lane: string, options: { push: boolean; dir: string }) => {
    try {
      const r = await runRelease(path.resolve(options.dir), lane, { push: options.push });
      console.log(r.committed ? `Released ${lane}.${pushNote(r)}` : `Lane ${lane} had no committed claim; nothing to release.`);
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('next')
  .description('List open units across all lanes with their claims, and recommend one nobody has claimed')
  .argument('[dir]', 'repo folder', '.')
  .option('--json', 'print the report as JSON (shape: NextReport in src/core/types.ts)')
  .action(async (dir: string, options: { json?: boolean }) => {
    try {
      const report = await runNext(path.resolve(dir));
      console.log(options.json ? JSON.stringify(report, null, 2) : formatNext(report));
    } catch (error) {
      fail(error);
    }
  });

const pauseNote = (r: PauseResult) => (r.pushed === false ? `\nCommitted, but the push failed: ${r.pushError}\nFix that (for a rejected push: \`git pull --rebase && git push\`) so the lanes see it.` : '');

program
  .command('pause')
  .description('Stop every lane run and the control room: writes .ai/PAUSED, commits (Lane: control) and pushes')
  .option('--reason <text>', 'why (shown on the dashboard)')
  .option('--as <name>', 'your name (default: git config user.name)')
  .option('--no-push', 'commit but do not push')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { reason?: string; as?: string; push: boolean; dir: string }) => {
    try {
      const r = await runPause(path.resolve(options.dir), { ...(options.reason && { reason: options.reason }), ...(options.as && { as: options.as }), push: options.push });
      console.log(r.changed ? `Paused. Scheduled runs now stop at their first step; \`loop resume\` undoes it.${pauseNote(r)}` : `Already paused by ${r.by}.`);
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('resume')
  .description('Undo `loop pause`: removes .ai/PAUSED, commits (Lane: control) and pushes')
  .option('--no-push', 'commit but do not push')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { push: boolean; dir: string }) => {
    try {
      const r = await runResume(path.resolve(options.dir), { push: options.push });
      console.log(r.changed ? `Resumed.${pauseNote(r)}` : 'Not paused; nothing to do.');
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

const scheduleNote = (r: ScheduleResult) => (r.pushed === false ? `\nCommitted, but the push failed: ${r.pushError}` : '');

const scheduleCmd = program.command('schedule').description('Which lanes are due (.ai/schedule.json): show, pause, resume, snooze, wake, update');
const scheduleOpts = <T extends Command>(c: T) =>
  c.option('--no-commit', 'write the file but do not commit').option('--no-push', 'commit but do not push').option('--dir <dir>', 'repo folder', '.');
type ScheduleFlags = { commit: boolean; push: boolean; dir: string };

scheduleCmd
  .command('show')
  .description('Each lane: due, paused, sleeping or snoozed, with idle runs')
  .option('--json', 'print the report as JSON (shape: ScheduleReport in src/cli/schedule.ts)')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { json?: boolean; dir: string }) => {
    try {
      const report = await runScheduleShow(path.resolve(options.dir));
      console.log(options.json ? JSON.stringify(report, null, 2) : formatScheduleReport(report));
    } catch (error) {
      fail(error);
    }
  });

const simple = (name: string, args: string, description: string, build: (a: string[], o: { reason?: string }) => ScheduleAction, withReason: boolean) => {
  const c = scheduleOpts(scheduleCmd.command(`${name} ${args}`).description(description));
  if (withReason) c.option('--reason <text>', 'why');
  c.action(async (...argv: unknown[]) => {
    const opts = argv[argv.length - 2] as ScheduleFlags & { reason?: string };
    const positional = argv.slice(0, -2) as string[];
    try {
      const r = await runScheduleAction(path.resolve(opts.dir), build(positional, opts), { commit: opts.commit, push: opts.push });
      console.log(r.changed.length ? `${name}: ${r.changed.join(', ')}${scheduleNote(r)}` : `${name}: nothing to change.`);
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });
};
simple('pause', '<lane>', 'Hold a lane back until it is resumed', ([lane], o) => ({ action: 'pause', lane: lane as string, ...(o.reason && { reason: o.reason }) }), true);
simple('resume', '<lane>', 'Undo `schedule pause`', ([lane]) => ({ action: 'resume', lane: lane as string }), false);
simple('snooze', '<lane> <until>', 'Hold a lane back until a time (ISO, a date, or 3h / 2d)', ([lane, until], o) => ({ action: 'snooze', lane: lane as string, until: until as string, ...(o.reason && { reason: o.reason }) }), true);
simple('wake', '<lane|all>', 'Make a sleeping or snoozed lane due now', ([lane]) => ({ action: 'wake', lane: lane as string }), false);

scheduleOpts(scheduleCmd.command('update').description('Idle backoff from the run logs, and wake lanes that have steering, a message or a new round'))
  .option('--new-round', 'a new round started: wake every lane')
  .option('--lane <name>', 'change only this lane\'s entry and commit as that lane (the end-of-run backoff)')
  .action(async (options: ScheduleFlags & { newRound?: boolean; lane?: string }) => {
    try {
      const r = await runScheduleUpdate(path.resolve(options.dir), { commit: options.commit, push: options.push, ...(options.newRound && { newRound: true }), ...(options.lane && { lane: options.lane }) });
      console.log(r.changed.length ? `update: ${r.changed.join(', ')}${scheduleNote(r)}` : 'update: nothing to change.');
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

const paceCmd = program.command('pace').description('How much checking a run does (.ai/policy.json): show, set');
paceCmd
  .command('show')
  .description('The global pace and any lane overrides, with what each skips')
  .option('--json', 'print the report as JSON (shape: PaceReport in src/cli/pace.ts)')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { json?: boolean; dir: string }) => {
    try {
      const report = await runPaceShow(path.resolve(options.dir));
      console.log(options.json ? JSON.stringify(report, null, 2) : formatPaceReport(report));
    } catch (error) {
      fail(error);
    }
  });
scheduleOpts(paceCmd.command('set').description('Set the pace: careful, balanced, fast or sprint (commits with Lane: control)'))
  .argument('<preset>', 'careful | balanced | fast | sprint')
  .option('--lane <name>', 'override only this lane')
  .action(async (preset: string, options: ScheduleFlags & { lane?: string }) => {
    try {
      const r = await runPaceSet(path.resolve(options.dir), preset, { commit: options.commit, push: options.push, ...(options.lane && { lane: options.lane }) });
      console.log(r.changed.length ? `pace: ${preset}${options.lane ? ` for ${options.lane}` : ''}${scheduleNote(r)}` : 'pace: nothing to change.');
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

program
  .command('steer')
  .description('Leave a note for a lane in .ai/lanes/<lane>/steer.md, wake the lane and commit (Lane: control)')
  .argument('<lane>', 'lane name')
  .argument('<text>', 'what the lane should do')
  .option('--standing', 'applies to every run until removed (default: the next run only)')
  .option('--author <name>', 'your name (default: git config user.name)')
  .option('--no-commit', 'write the file but do not commit')
  .option('--no-push', 'commit but do not push')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (lane: string, text: string, options: SteerFlags) => {
    try {
      const r = await runSteer(path.resolve(options.dir), lane, text, { commit: options.commit, push: options.push, ...(options.standing && { standing: true }), ...(options.author && { author: options.author }) });
      console.log(`Steer saved for ${lane}${options.standing ? ' (standing)' : ''}.${scheduleNote(r)}`);
      if (r.pushed === false) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });
type SteerFlags = ScheduleFlags & { standing?: boolean; author?: string };

program
  .command('ship-check')
  .description('Is this repo ready to release? Checks DONE.md, open findings, CHANGELOG, the tag, a clean tree and the latest test result; exit 0 only if ready')
  .argument('[dir]', 'repo folder', '.')
  .option('--json', 'print the checklist as JSON (shape: ShipCheck in src/core/shipCheck.ts)')
  .action(async (dir: string, options: { json?: boolean }) => {
    try {
      const result = await runShipCheck(path.resolve(dir));
      console.log(options.json ? JSON.stringify(result, null, 2) : formatShipCheck(result));
      if (!result.ready) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });

const runsCommand = program
  .command('runs')
  .description('List each lane\'s logged runs and the scheduled runs that left no trace (from .ai/lanes/<lane>/runs.jsonl and each lane\'s cron)')
  .option('--json', 'print the report as JSON (shape: RunsReport in src/cli/runs.ts)')
  .option('--hours <n>', 'how far back to look', '24')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { json?: boolean; hours: string; dir: string }) => {
    try {
      const report = await readRuns(path.resolve(options.dir), { hours: Number(options.hours) });
      console.log(options.json ? JSON.stringify(report, null, 2) : formatRuns(report));
    } catch (error) {
      fail(error);
    }
  });

runsCommand
  .command('log')
  .description('Append one line to a lane\'s run log; every lane run ends with this and commits the file with its last commit')
  .requiredOption('--lane <name>', 'lane name from .ai/lanes.json')
  .option('--units <list...>', 'units finished this run')
  .option('--passed <n>', 'tests passed on the last npm test')
  .option('--failed <n>', 'tests failed on the last npm test')
  .option('--triggers <n>', 'how many triggers fired during the run (see `loop triggers stats`)')
  .option('--pushed', 'this run pushed to main')
  .option('--no-pushed', 'this run pushed nothing')
  .option('--session <url>', 'session link or id')
  .option('--note <text>', 'one line of context')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { lane: string; units?: string[]; passed?: string; failed?: string; triggers?: string; pushed?: boolean; session?: string; note?: string; dir: string }) => {
    try {
      // The parent `runs` command declares --dir too and Commander gives it the value wherever it appears.
      const dir = options.dir !== '.' ? options.dir : (runsCommand.opts<{ dir: string }>().dir);
      const entry = await logRun(path.resolve(dir), options.lane, {
        ...(options.units && { units: options.units }),
        ...(options.passed !== undefined && { passed: Number(options.passed) }),
        ...(options.failed !== undefined && { failed: Number(options.failed) }),
        ...(options.triggers !== undefined && { triggers: Number(options.triggers) }),
        pushed: options.pushed ?? false,
        ...(options.session && { session: options.session }),
        ...(options.note && { note: options.note }),
      });
      console.log(`Logged ${entry.lane} run at ${entry.at} (${entry.pushed ? 'pushed' : 'pushed nothing'}). Commit .ai/lanes/${entry.lane}/runs.jsonl with your last commit.`);
    } catch (error) {
      fail(error);
    }
  });

const recipeCmd = program.command('recipe').description('Recipes: small exact contexts for work you repeat (.ai/recipes/, ~/.ai/recipes/)');
recipeCmd
  .command('list')
  .description('Every recipe in the project and user stores')
  .option('--json', 'print as JSON (RecipeSummary[])')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { json?: boolean; dir: string }) => {
    try {
      const recipes = await listRecipes(path.resolve(options.dir));
      console.log(options.json ? JSON.stringify(recipes, null, 2) : formatRecipeList(recipes));
    } catch (error) {
      fail(error);
    }
  });
recipeCmd
  .command('show')
  .description('Print a recipe; --context prints exactly what a model would receive (no front matter)')
  .argument('<id>', 'recipe id, e.g. R-static-calculator-site')
  .option('--context', 'drop the front matter')
  .option('--json', 'print {id, context|text} as JSON')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (id: string, options: { context?: boolean; json?: boolean; dir: string }) => {
    try {
      const text = await showRecipe(path.resolve(options.dir), id, options.context === true);
      console.log(options.json ? JSON.stringify({ id, [options.context ? 'context' : 'text']: text }, null, 2) : text.trimEnd());
    } catch (error) {
      fail(error);
    }
  });
recipeCmd
  .command('match')
  .description('Rank recipes for this repo (stack from package.json) and an optional task text; prints the top 3')
  .argument('[task...]', 'what you are about to do')
  .option('--json', 'print as JSON')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (task: string[], options: { json?: boolean; dir: string }) => {
    try {
      const matches = await matchHere(path.resolve(options.dir), task.join(' '));
      console.log(options.json ? JSON.stringify(matches, null, 2) : formatMatches(matches));
    } catch (error) {
      fail(error);
    }
  });
recipeCmd
  .command('check')
  .description('Lint a recipe file (or every project recipe): fields, sections, 6 KB cap, a proof per step, no paths, emails or tokens')
  .argument('[file]', 'recipe file')
  .option('--json', 'print as JSON')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (file: string | undefined, options: { json?: boolean; dir: string }) => {
    try {
      const results = await checkRecipes(path.resolve(options.dir), file);
      if (options.json) console.log(JSON.stringify(results, null, 2));
      else if (results.length === 0) console.log('No recipes to check.');
      else for (const r of results) console.log(r.problems.length ? `${r.file}\n- ${r.problems.join('\n- ')}` : `${r.file}: ok`);
      if (results.some((r) => r.problems.length > 0)) process.exitCode = 1;
    } catch (error) {
      fail(error);
    }
  });
recipeCmd
  .command('draft')
  .description('Ask Claude (claude -p) to draft a recipe from finished work; writes .ai/recipes/<id>.draft.md and scores it. A human renames it to accept it')
  .option('--from <lane|dir>', 'a lane name, or a folder inside the repo with its own .ai/ (default: this repo)')
  .option('--id <id>', 'the recipe id (R-<slug>); an existing id gets a delta, not a rewrite')
  .option('--print-prompt', 'print the prompt only; makes no Claude call')
  .option('--model <model>', 'the Claude model to use')
  .option('--json', 'print as JSON')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { from?: string; id?: string; printPrompt?: boolean; model?: string; json?: boolean; dir: string }) => {
    try {
      const r = await runRecipeDraft(path.resolve(options.dir), { ...(options.from && { from: options.from }), ...(options.id && { id: options.id }), ...(options.printPrompt && { printPrompt: true }), ...(options.model && { model: options.model }) });
      if (options.json) console.log(JSON.stringify(r, null, 2));
      else if (!r.draft) console.log(r.prompt);
      else if (r.delta) console.log(`${r.draft}\n\nThis id already exists, so this is a delta: apply the items by hand, nothing was written.`);
      else if (!r.outFile) console.log(`${r.draft}\n\nNot saved: ${(r.problems ?? []).join(' ')}`);
      else console.log(`Draft written to ${r.outFile}.${r.problems?.length ? ` Fix before accepting:\n- ${r.problems.join('\n- ')}` : ' It passes `loop recipe check`.'}\nAccept it by renaming it to ${r.outFile.replace('.draft', '')}, or \`loop recipe add ${r.outFile}\`.`);
    } catch (error) {
      fail(error);
    }
  });
recipeCmd
  .command('add')
  .description('Copy a recipe that passes `check` into .ai/recipes/ (or ~/.ai/recipes/ with --global)')
  .argument('<file>', 'recipe file')
  .option('--global', 'add to the user store')
  .option('--json', 'print as JSON')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (file: string, options: { global?: boolean; json?: boolean; dir: string }) => {
    try {
      const added = await addRecipe(path.resolve(options.dir), file, options.global === true);
      console.log(options.json ? JSON.stringify(added, null, 2) : `Added ${added.id} to ${added.path}`);
    } catch (error) {
      fail(error);
    }
  });

program
  .command('hook')
  .description('Claude Code hook entry point: reads the hook JSON on stdin and prints context from .ai/triggers.yaml (or the best recipe on SessionStart). Always exits 0')
  .argument('<event>', 'SessionStart | UserPromptSubmit | PreToolUse | PostToolUse | PostToolUseFailure')
  .action(async (event: string) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
      const out = await runHook(event, Buffer.concat(chunks).toString('utf8'), path.resolve(process.env.CLAUDE_PROJECT_DIR || '.'));
      if (out) process.stdout.write(`${out}\n`);
    } catch {
      // A broken hook must never break a run: print nothing.
    }
    process.exitCode = 0;
  });

const triggersCmd = program.command('triggers').description('Triggers from .ai/triggers.yaml');
triggersCmd
  .command('stats')
  .description('How often each trigger fired (from .ai/.trigger-log.jsonl)')
  .option('--json', 'print as JSON')
  .option('--dir <dir>', 'repo folder', '.')
  .action(async (options: { json?: boolean; dir: string }) => {
    try {
      const report = await triggersStats(path.resolve(options.dir));
      console.log(options.json ? JSON.stringify(report, null, 2) : formatTriggersReport(report));
    } catch (error) {
      fail(error);
    }
  });

await program.parseAsync();
