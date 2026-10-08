// Fast structural checks for extension/. No dependencies, no browser. Messages say how to fix each problem.
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(process.argv[2] ?? 'extension');
const errors = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);

const manifestPath = join(DIR, 'manifest.json');
let manifest = null;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); } catch { fail('manifest.json', 'missing or not valid JSON.'); }

if (manifest) {
  if (manifest.manifest_version !== 3) fail('manifest.json', '"manifest_version" must be 3; Chrome no longer accepts version 2.');
  for (const key of ['name', 'version', 'description']) if (!manifest[key]) fail('manifest.json', `add "${key}".`);
  if (manifest.version && !/^\d+(\.\d+){0,3}$/.test(manifest.version)) fail('manifest.json', `"version" ${manifest.version} must be 1-4 dot-separated integers.`);
  if (manifest.description && manifest.description.length > 132) fail('manifest.json', 'description is over 132 characters; the Chrome Web Store rejects it.');

  const files = [manifest.action?.default_popup, manifest.background?.service_worker, ...Object.values(manifest.icons ?? {})].filter(Boolean);
  for (const f of files) if (!existsSync(join(DIR, f))) fail('manifest.json', `references "${f}", which does not exist in extension/.`);

  // Least privilege: broad host access and risky permissions need a reason from the owner.
  const risky = [...(manifest.host_permissions ?? []), ...(manifest.permissions ?? [])].filter((p) => /<all_urls>|\*:\/\/\*\/\*|^(tabs|history|cookies|webRequest|debugger)$/.test(p));
  if (risky.length) fail('manifest.json', `broad permissions (${risky.join(', ')}). Use the narrowest permission that works, or ask the owner.`);
  if (manifest.content_security_policy?.extension_pages && /unsafe-(inline|eval)/.test(manifest.content_security_policy.extension_pages)) fail('manifest.json', 'CSP allows unsafe-inline or unsafe-eval.');
}

// MV3 blocks inline scripts and remote code.
const popup = manifest?.action?.default_popup;
if (popup && existsSync(join(DIR, popup))) {
  const html = readFileSync(join(DIR, popup), 'utf8');
  for (const [tag] of html.matchAll(/<script\b[^>]*>/gi)) {
    const src = tag.match(/\ssrc="([^"]+)"/i)?.[1];
    if (!src) fail(popup, 'inline <script>. Move it to a .js file; MV3 blocks inline scripts.');
    else if (/^(https?:)?\/\//i.test(src)) fail(popup, `remote script "${src}". MV3 forbids remotely hosted code; bundle it in extension/.`);
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) fail(popup, 'inline event handler. Use addEventListener in a .js file.');
}

// Secrets must never be committed.
const SECRET = /(\bsk-(ant-)?[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}|\bgh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
for (const f of ['background.js', 'popup.js', 'popup.html', 'manifest.json']) {
  const p = join(DIR, f);
  if (existsSync(p) && SECRET.test(readFileSync(p, 'utf8'))) fail(f, 'looks like it contains an API key or private key. Remove it.');
}

if (errors.length) {
  console.error(`check: ${errors.length} problem(s)\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('check: OK');
