// Renders social-preview.svg to a 1280x640 PNG. Run: node launch/render-social-preview.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = (f) => fileURLToPath(new URL(f, import.meta.url));
const exe = ['/opt/pw-browsers/chromium'].find(existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
await page.setContent(`<body style="margin:0">${readFileSync(here('social-preview.svg'), 'utf8')}</body>`);
writeFileSync(here('social-preview.png'), await page.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 640 } }));
await browser.close();
