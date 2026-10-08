import { withSessionLock } from '/home/user/Compounding-Loop/src/cli/lock.js';
import { spawn } from 'node:child_process';
await withSessionLock('/tmp/claude-0/s/x/session.lock', () => new Promise<number>((r)=>{ const c=spawn('sleep',['5'],{stdio:'inherit'}); c.on('close',()=>r(0)); }));
