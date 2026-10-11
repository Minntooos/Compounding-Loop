import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as parse from '../../../src/core/parse/index.js';
import { parseStopMarkers } from '../../../src/core/parse/markers.js';
import { parseRunCounter, parseTaskFile, parseUnits, sectionOf } from '../../../src/core/parse/task.js';

const task = `# Lane: core

Run: 3 / 20
Status: in progress (units 1-2 done)

## Units, in order
1. Audit
2. Parsers (\`src/core/parse/**\`)
- not a unit
10. Tenth

## Handoff

Run 3 shipped unit 2.
Next: unit 3.
`;

describe('parseTaskFile', () => {
  it('reads run counter, status, units and the first handoff line', () => {
    const p = parseTaskFile(task);
    expect(p.run).toEqual({ run: 3, limit: 20 });
    expect(p.status).toBe('in progress (units 1-2 done)');
    expect(p.handoffFirstLine).toBe('Run 3 shipped unit 2.');
    expect(p.units.map((u) => u.number)).toEqual([1, 2, 10]);
    expect(p.units[1]?.text).toContain('Parsers');
  });
  it('leaves missing parts out instead of inventing them', () => {
    expect(parseTaskFile('# nothing here')).toEqual({ units: [] });
    expect(parseRunCounter('Run: x / y')).toBeUndefined();
  });
  it('sectionOf matches by heading prefix and stops at the next heading', () => {
    expect(sectionOf(task, 'units')).not.toContain('Tenth\n\n## ');
    expect(sectionOf(task, 'Missing')).toBeUndefined();
    expect(parseUnits('## Handoff\n1. x')).toEqual([]);
  });
  it('uses the newest of several Handoff sections', () => {
    expect(parseTaskFile('## Handoff\nold\n\n## Handoff (run 2)\nnew\n').handoffFirstLine).toBe('new');
  });
  it('handles CRLF files', () => {
    expect(parseTaskFile(task.replace(/\n/g, '\r\n')).units).toHaveLength(3);
  });
  it('parses this repo\'s own task files', () => {
    for (const lane of ['core', 'web', 'server', 'kit', 'docs']) {
      const p = parseTaskFile(readFileSync(`.ai/lanes/${lane}/task.md`, 'utf8'));
      expect(p.run?.limit, lane).toBeGreaterThan(0);
      expect(p.units.length, lane).toBeGreaterThan(0);
    }
  });
});

describe('parseStopMarkers', () => {
  it('finds root and lane markers, also with Windows separators', () => {
    const m = parseStopMarkers(['DONE.md', '.ai/lanes/web/DONE.md', '.ai\\lanes\\kit\\BLOCKED.md', '.ai/lanes/docs/task.md', 'src/DONE.md']);
    expect(m).toEqual({ rootDone: true, rootBlocked: false, paused: false, doneLanes: ['web'], blockedLanes: ['kit'] });
  });
  it('is empty for no files', () => {
    expect(parseStopMarkers([])).toEqual({ rootDone: false, rootBlocked: false, paused: false, doneLanes: [], blockedLanes: [] });
  });
});

describe('parse entry point', () => {
  it('re-exports the lanes parsers and trailer reader', () => {
    expect(parse.parseLaneTrailer('msg\n\nLane: core')).toBe('core');
    expect(parse.parseLanesConfig('{"lanes":[{"name":"a","owns":["a/**"]}],"shared":[]}').errors).toEqual([]);
    expect(typeof parse.parseOutbox).toBe('function');
  });
  it('no file in src/core/parse imports node: or the Node-only core modules', () => {
    const dir = 'src/core/parse';
    for (const f of readdirSync(dir)) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      expect(text, f).not.toMatch(/from ['"]node:|require\(/);
    }
  });
  it('the modules it re-exports from are browser-safe too', () => {
    for (const f of ['lanes.ts', 'laneStatus.ts', 'status.ts', 'types.ts']) {
      expect(readFileSync(path.join('src/core', f), 'utf8'), f).not.toMatch(/from ['"]node:/);
    }
  });
});
