import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, describe, expect, it } from 'vitest';
import { fillPlaceholders, isTextFile } from '../../../src/core/template.js';

const root = process.cwd();
const template = join(root, 'templates', 'chrome-extension');
const temps: string[] = [];

function freshCopy(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'cl-ext-'));
  temps.push(dir);
  cpSync(template, dir, { recursive: true });
  const walk = (d: string): void => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (isTextFile(entry)) writeFileSync(p, fillPlaceholders(readFileSync(p, 'utf8'), { name }));
    }
  };
  walk(dir);
  return dir;
}

/** True when some Chromium (Playwright's, a preinstalled one or a system Chrome) can be found. */
function chromiumAvailable(): boolean {
  try {
    if (existsSync(chromium.executablePath())) return true;
  } catch {
    /* fall through to the other locations */
  }
  const candidates = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome'];
  for (const dir of ['/opt/pw-browsers', join(process.env.HOME ?? '', '.cache', 'ms-playwright')]) {
    try {
      for (const d of readdirSync(dir)) candidates.push(join(dir, d, 'chrome-linux64', 'chrome'), join(dir, d, 'chrome-linux', 'chrome'));
    } catch {
      /* directory absent */
    }
  }
  return candidates.some((p) => p !== undefined && existsSync(p));
}

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe('templates/chrome-extension', () => {
  it('has a Manifest V3 manifest with a popup and a service worker', () => {
    const manifest = JSON.parse(readFileSync(join(template, 'extension', 'manifest.json'), 'utf8')) as Record<string, any>; // any: manifest shape is open-ended
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.background.service_worker).toBe('background.js');
  });

  it('passes its own check script when freshly copied', () => {
    const dir = freshCopy('demo-ext');
    expect(execFileSync(process.execPath, ['scripts/check.mjs'], { cwd: dir, encoding: 'utf8' })).toContain('check: OK');
  });

  it('check script rejects an MV2 manifest, an inline script and broad permissions', () => {
    const dir = freshCopy('demo-ext');
    const manifestPath = join(dir, 'extension', 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, manifest_version: 2, permissions: ['tabs', '<all_urls>'] }));
    writeFileSync(join(dir, 'extension', 'popup.html'), '<html><body><script>alert(1)</script></body></html>');
    let output = '';
    try {
      execFileSync(process.execPath, ['scripts/check.mjs'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      output = String((error as { stderr?: string }).stderr);
    }
    expect(output).toContain('manifest_version');
    expect(output).toContain('broad permissions');
    expect(output).toContain('inline <script>');
  });

  it.skipIf(!chromiumAvailable())('its Playwright extension test passes in a temp copy', () => {
    const dir = freshCopy('demo-ext');
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'junction');
    const bin = join(root, 'node_modules', '@playwright', 'test', 'cli.js');
    execFileSync(process.execPath, [bin, 'test'], { cwd: dir, stdio: 'inherit' });
  }, 120_000);
});
