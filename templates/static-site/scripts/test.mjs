// `npm test`: runs each test step in order (stopping at the first failure, like `&&`) and writes the
// totals to .ai/last-test.json, which the Compounding Loop dashboard's "failing tests" health check reads.
// Commit that file with your work so the dashboard sees it whichever machine ran the tests.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Totals from test-runner output: node:test (`ℹ pass 3` or TAP `# pass 3`) and Playwright (`12 passed`, `1 failed`). */
export function countResults(output) {
  const plain = output.replace(/\x1b\[[0-9;]*m/g, '');
  const sum = (re) => [...plain.matchAll(re)].reduce((n, m) => n + Number(m[1]), 0);
  const passed = sum(/^\s*(?:ℹ|#) pass (\d+)\s*$/gm) + sum(/^\s*(\d+) passed\b/gm);
  const failed = sum(/^\s*(?:ℹ|#) fail (\d+)\s*$/gm) + sum(/^\s*(\d+) failed\b/gm);
  return passed + failed > 0 ? { passed, failed } : undefined;
}

/** Steps this repo has, as [label, node arguments]. Node runs them directly, so no shell or .cmd shim is involved. */
function steps() {
  const list = [['check', ['scripts/check.mjs']]];
  if (existsSync('tests/unit')) list.push(['unit', ['--test', 'tests/unit/**/*.test.mjs']]);
  if (existsSync('playwright.config.js')) list.push(['browser', [path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test', ...process.argv.slice(2)]]);
  return list;
}

function run(args) {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(process.execPath, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { output += chunk; process.stdout.write(chunk); });
    child.stderr.on('data', (chunk) => { output += chunk; process.stderr.write(chunk); });
    child.on('error', (error) => { output += String(error); resolve({ code: 1, output }); });
    child.on('close', (code) => resolve({ code: code ?? 1, output }));
  });
}

async function main() {
  const total = { passed: 0, failed: 0 };
  let code = 0;
  for (const [label, args] of steps()) {
    const result = await run(args);
    // A step without countable output (the check script) counts as one test.
    const counts = countResults(result.output) ?? (result.code === 0 ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 });
    if (result.code !== 0 && counts.failed === 0) counts.failed = 1;
    total.passed += counts.passed;
    total.failed += counts.failed;
    if (result.code !== 0) {
      console.error(`\n${label} failed (exit ${result.code}); later steps skipped.`);
      code = result.code;
      break;
    }
  }
  mkdirSync('.ai', { recursive: true });
  writeFileSync(path.join('.ai', 'last-test.json'), `${JSON.stringify({ ...total, at: new Date().toISOString() })}\n`);
  console.log(`\n${total.passed} passed, ${total.failed} failed (written to .ai/last-test.json)`);
  process.exitCode = code;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
