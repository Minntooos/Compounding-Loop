// Pure part of `loop doctor`: turn probe results into checks with a fix for each failure.

export interface ProbeResult {
  ok: boolean;
  /** Trimmed stdout (a version string) or the error message. */
  output: string;
}

export interface Check {
  id: string;
  label: string;
  /** A missing required tool makes `loop doctor` exit non-zero; the rest only limit what you can do. */
  required: boolean;
  ok: boolean;
  detail: string;
  /** How to fix it; empty when ok. */
  fix: string;
}

export interface DoctorInput {
  nodeVersion: string;
  git: ProbeResult;
  gh: ProbeResult;
  ghAuth: ProbeResult;
  claude: ProbeResult;
  /** Path of an installed Playwright Chromium, or undefined. */
  chromium: string | undefined;
}

export const MIN_NODE_MAJOR = 20;

export function parseNodeMajor(version: string): number {
  const major = Number(/^v?(\d+)/.exec(version.trim())?.[1]);
  return Number.isFinite(major) ? major : 0;
}

const firstLine = (text: string) => text.trim().split(/\r?\n/)[0] ?? '';

export function evaluateDoctor(input: DoctorInput): Check[] {
  const nodeOk = parseNodeMajor(input.nodeVersion) >= MIN_NODE_MAJOR;
  return [
    {
      id: 'node', label: `Node.js ${MIN_NODE_MAJOR} or newer`, required: true, ok: nodeOk, detail: input.nodeVersion,
      fix: nodeOk ? '' : `Install Node.js ${MIN_NODE_MAJOR}+ from https://nodejs.org (or use nvm/fnm), then open a new terminal.`,
    },
    {
      id: 'git', label: 'git', required: true, ok: input.git.ok, detail: input.git.ok ? firstLine(input.git.output) : 'not found',
      fix: input.git.ok ? '' : 'Install git from https://git-scm.com/downloads and make sure `git --version` works.',
    },
    {
      id: 'claude', label: 'Claude Code (claude)', required: true, ok: input.claude.ok, detail: input.claude.ok ? firstLine(input.claude.output) : firstLine(input.claude.output) || 'not found',
      fix: input.claude.ok ? '' : input.claude.output.includes('.cmd') ? input.claude.output : 'Install Claude Code (https://docs.claude.com/en/docs/claude-code), then run `claude` once to sign in.',
    },
    {
      id: 'gh', label: 'GitHub CLI (gh), needed by `loop new` and for pushing', required: false, ok: input.gh.ok, detail: input.gh.ok ? firstLine(input.gh.output) : 'not found',
      fix: input.gh.ok ? '' : 'Install gh from https://cli.github.com. Without it, use `loop new --dry-run` and create the repo yourself.',
    },
    {
      id: 'gh-auth', label: 'gh is signed in', required: false, ok: input.ghAuth.ok, detail: input.ghAuth.ok ? 'signed in' : input.gh.ok ? 'not signed in' : 'skipped (gh missing)',
      fix: input.ghAuth.ok || !input.gh.ok ? '' : 'Run `gh auth login` and choose GitHub.com.',
    },
    {
      id: 'chromium', label: 'Playwright Chromium, needed by generated sites\' browser tests', required: false, ok: input.chromium !== undefined, detail: input.chromium ?? 'not found',
      fix: input.chromium !== undefined ? '' : 'Run `npx playwright install chromium` (add `npx playwright install-deps chromium` on Linux if Chrome fails to start).',
    },
  ];
}

export function doctorPassed(checks: readonly Check[]): boolean {
  return checks.every((c) => c.ok || !c.required);
}

export function formatDoctor(checks: readonly Check[]): string {
  const lines = checks.map((c) => {
    const mark = c.ok ? 'ok     ' : c.required ? 'MISSING' : 'missing';
    return `${mark}  ${c.label}: ${c.detail}${c.fix ? `\n         fix: ${c.fix}` : ''}`;
  });
  const bad = checks.filter((c) => !c.ok && c.required).length;
  lines.push('', bad > 0 ? `${bad} required tool(s) missing. Fix them and run \`loop doctor\` again.` : 'Everything required is installed.');
  return lines.join('\n');
}
