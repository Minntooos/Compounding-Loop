export const TEMPLATES = [
  { id: 'static-site', label: 'Static site', blurb: 'HTML/CSS/JS pages, deployable anywhere.' },
  { id: 'chrome-extension', label: 'Chrome extension', blurb: 'Manifest V3 extension.' },
] as const;

export const RUNNERS = [
  { id: 'routine', label: 'Claude Code routine', blurb: 'Scheduled cloud run; nothing to keep on.' },
  { id: 'github-actions', label: 'GitHub Actions', blurb: 'Runs on a cron in your repo.' },
  { id: 'local', label: 'Local loop', blurb: 'Runs on this machine with `loop run`.' },
] as const;

/** Folder-safe repo name: lowercase letters, digits and dashes only, so the shown command needs no shell quoting. */
export function slugName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
}

export function newLoopCommand(template: string, name: string): string {
  const slug = slugName(name);
  return `npx compounding-loop new ${template}${slug ? ` ${slug}` : ''}`;
}
