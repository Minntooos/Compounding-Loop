import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, OctagonAlert } from 'lucide-react';
import { api } from '../api/client';
import { checkLabel, humanizeTimes } from '../lib/health';
import { LoadError, Loading } from './QueryState';

function Doctor() {
  const q = useQuery({ queryKey: ['doctor'], queryFn: api.doctor });
  if (q.isPending || q.isError || !q.data) return null; // optional extra: the checks above stand alone
  const { passed, report } = q.data;
  return (
    <section aria-labelledby="doctor-h" className="mt-6">
      <h2 id="doctor-h" className="mb-2 flex items-center gap-1.5 text-[15px] font-semibold">
        {passed ? <CheckCircle2 aria-hidden size={16} style={{ color: 'var(--done)' }} /> : <OctagonAlert aria-hidden size={16} style={{ color: 'var(--failing)' }} />}
        Doctor: {passed ? 'passed' : 'found problems'}
      </h2>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border p-3 font-mono text-[12px]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} tabIndex={0} aria-label="Doctor report">{report}</pre>
    </section>
  );
}

export function Health() {
  const q = useQuery({ queryKey: ['checks'], queryFn: api.checks });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError what="the checks" onRetry={() => void q.refetch()} busy={q.isFetching} />;
  if (q.data.length === 0) return <p style={{ color: 'var(--muted)' }}>No checks yet. Add a loop to see them.</p>;
  return (
    <>
    <ul className="space-y-2" aria-label="Health checks">
      {q.data.map((c) => (
        <li key={`${c.loopId}/${c.kind}`} className="flex flex-wrap items-start gap-3 rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <span className="flex items-center gap-1.5 font-medium" style={{ color: c.ok ? 'var(--done)' : 'var(--failing)' }}>
            {c.ok ? <CheckCircle2 aria-hidden size={16} /> : <OctagonAlert aria-hidden size={16} />}{c.ok ? 'OK' : 'Failing'}
          </span>
          <span className="flex-1"><strong>{c.loopId}</strong> · {checkLabel(c.kind, c.ok)}<br /><span style={{ color: 'var(--muted)' }}>{humanizeTimes(c.reason)}</span></span>
          <code className="font-mono text-[12px]" style={{ color: 'var(--muted)' }}>{humanizeTimes(c.proof)}</code>
        </li>
      ))}
    </ul>
    <Doctor />
    </>
  );
}
