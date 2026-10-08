import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Gh } from '../core/gh.js';
import { fillPlaceholders, hostLabel, isTextFile, TEMPLATE_IGNORED, templateTargetName, validateProjectName } from '../core/template.js';
import { packageRoot, runInit } from './init.js';

export interface NewOptions {
  /** Where the new folder is created. */
  parentDir: string;
  dryRun: boolean;
  /** Create the GitHub repo as public. Private by default. */
  publicRepo: boolean;
  gh: Gh;
  /** Package root holding `templates/` and `method/`. */
  root?: string;
}

export interface NewResult {
  dir: string;
  repoUrl?: string;
}

export async function listTemplates(root: string = packageRoot): Promise<string[]> {
  const entries = await readdir(path.join(root, 'templates'), { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

/** Copies `source` to `dest`, filling `{{placeholders}}` in text files. */
async function copyTemplate(source: string, dest: string, vars: Record<string, string>): Promise<void> {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (TEMPLATE_IGNORED.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(dest, templateTargetName(entry.name));
    if (entry.isDirectory()) await copyTemplate(from, to, vars);
    else if (isTextFile(templateTargetName(entry.name))) await writeFile(to, fillPlaceholders(await readFile(from, 'utf8'), vars));
    else await cp(from, to);
  }
}

export async function runNew(template: string, name: string, options: NewOptions): Promise<NewResult> {
  const root = options.root ?? packageRoot;
  const nameError = validateProjectName(name);
  if (nameError) throw new Error(nameError);
  const available = await listTemplates(root);
  if (!available.includes(template)) {
    throw new Error(`Unknown template "${template}". Available: ${available.join(', ') || 'none'}.`);
  }
  const dir = path.join(options.parentDir, name);
  if (await stat(dir).then(() => true, () => false)) throw new Error(`${dir} already exists; pick another name.`);

  await copyTemplate(path.join(root, 'templates', template), dir, { name, template, host: hostLabel(name) });
  // The brief is written after creation (dashboard wizard or by hand), so the brief gate is skipped here.
  const init = await runInit(dir, { force: true, dryRun: false });
  if (init.refused) throw new Error(init.refused);
  if (options.dryRun) return { dir };
  try {
    const repoUrl = await options.gh.createRepoFromFolder(dir, name, { private: !options.publicRepo });
    return { dir, repoUrl };
  } catch (error) {
    // The folder is regenerable from the template; leaving it would make a retry fail with "already exists".
    await rm(dir, { recursive: true, force: true });
    throw new Error(`Could not create the GitHub repo (is \`gh auth login\` done, and is the name free?). The folder was removed.\n${error instanceof Error ? error.message : String(error)}`);
  }
}
