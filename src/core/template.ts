// Pure helpers for `loop new`: names, placeholders and which files to fill.

/** Lowercase letters, digits, `-` and `_`; becomes a folder name and a GitHub repo name. */
const PROJECT_NAME = /^[a-z0-9][a-z0-9_-]{0,99}$/;

export function validateProjectName(name: string): string | undefined {
  return PROJECT_NAME.test(name)
    ? undefined
    : `"${name}" is not a valid name: use lowercase letters, digits, "-" or "_" (max 100 characters, starting with a letter or digit).`;
}

const TEXT_EXTENSIONS = new Set(['.md', '.json', '.js', '.mjs', '.ts', '.html', '.css', '.txt', '.xml', '.toml', '.yml', '.yaml', '.gitignore']);

/** True for files whose `{{placeholders}}` should be filled; everything else is copied byte for byte. */
export function isTextFile(fileName: string): boolean {
  const dot = fileName.lastIndexOf('.');
  return dot !== -1 && TEXT_EXTENSIONS.has(fileName.slice(dot).toLowerCase());
}

/** Replaces `{{key}}` with its value; unknown keys are left as they are so a typo stays visible. */
export function fillPlaceholders(text: string, vars: Readonly<Record<string, string>>): string {
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, key: string) => vars[key] ?? whole);
}

/** Names never copied out of a template. */
export const TEMPLATE_IGNORED = new Set(['node_modules', '.git', 'test-results', 'playwright-report']);
