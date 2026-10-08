// Turns a saved RemoteTrigger `list` response into the dashboard's meta/routines document.
// Usage: node dashboard/routines.mjs <file holding the RemoteTrigger list output> [out_file]
import { readFileSync, writeFileSync } from 'node:fs';

const NAMES = {
  trig_01H4XjfhSgT9L7WyJuVE13jr: 'proj1',
  trig_01JnuLdqZKsRLPQuBrisW4eZ: 'proj2',
  trig_01Js8cQpbPozmhdqPrnDHsWQ: 'proj3',
  trig_014K7NNEUy3qBovKD1xPuRE4: 'proj4',
  trig_0193CBtYyPVsDmfZ7Zchoioc: 'proj5',
  trig_013prmYQv81UNm2FuennV9f1: 'control',
};
const raw = readFileSync(process.argv[2], 'utf8');
const data = JSON.parse(raw.slice(raw.indexOf('{'))).data ?? [];
const items = {};
for (const t of data) {
  const name = NAMES[t.id];
  if (!name) continue;
  const lr = t.last_run ?? {};
  items[name] = {
    enabled: t.enabled !== false,
    nextRunAt: t.next_run_at ?? null,
    lastRun: {
      status: String(lr.status ?? '').replace('ROUTINE_RUN_STATUS_', '').toLowerCase(),
      firedAt: lr.fired_at ?? null,
      finishedAt: lr.finished_at ?? null,
      sessionId: lr.session_id ?? null,
    },
  };
}
const missing = Object.values(NAMES).filter((n) => !items[n]);
const out = process.argv[3] ?? new URL('./.out/routines.json', import.meta.url);
writeFileSync(out, JSON.stringify({ checkedAt: new Date().toISOString(), items }, null, 1));
console.log(`routines.json written (${Object.keys(items).length} routines${missing.length ? `, missing ${missing.join(', ')}` : ''})`);
