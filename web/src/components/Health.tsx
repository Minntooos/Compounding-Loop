import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, OctagonAlert } from 'lucide-react';
import { api } from '../api/client';

const KIND: Record<string, string> = {
  leak: 'Leaked text on the live site', 'stale-lock': 'Stale session lock', 'short-runs': 'Runs ending too fast',
  'failing-tests': 'Tests failing', 'runner-silent': 'Runner went quiet',
};

export function Health() {
  const q = useQuery({ queryKey: ['checks'], queryFn: api.checks });
  if (q.isPending) return <p role="status" style={{ color: 'var(--muted)' }}>Loading…</p>;
  if (q.isError) return <p role="alert" style={{ color: 'var(--failing)' }}>Could not load the checks.</p>;
  if (q.data.length === 0) return <p style={{ color: 'var(--muted)' }}>No checks yet. Add a loop to see them.</p>;
  return (
    <ul className="space-y-2" aria-label="Health checks">
      {q.data.map((c) => (
        <li key={`${c.loopId}/${c.kind}`} className="flex flex-wrap items-start gap-3 rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <span className="flex items-center gap-1.5 font-medium" style={{ color: c.ok ? 'var(--done)' : 'var(--failing)' }}>
            {c.ok ? <CheckCircle2 aria-hidden size={16} /> : <OctagonAlert aria-hidden size={16} />}{c.ok ? 'OK' : 'Failing'}
          </span>
          <span className="flex-1"><strong>{c.loopId}</strong> · {KIND[c.kind] ?? c.kind}<br /><span style={{ color: 'var(--muted)' }}>{c.reason}</span></span>
          <code className="font-mono text-[12px]" style={{ color: 'var(--muted)' }}>{c.proof}</code>
        </li>
      ))}
    </ul>
  );
}
