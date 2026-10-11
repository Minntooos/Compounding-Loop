import { CheckCircle2, XCircle } from 'lucide-react';
import type { LoopRun } from '@core/types';
import { dayHeading, timeUtc } from '../lib/timeline';
import { lastFailure, testSeries } from '../lib/runs';

const W = 600;
const H = 100;

const stamp = (at: string) => `${dayHeading(at.slice(0, 10))} ${timeUtc(at)} UTC`;

/** Tests per recorded run (from the run log) as hand-written SVG bars: red segment = failing. */
export function TestsTab({ runs }: { runs: LoopRun[] }) {
  const series = testSeries(runs);
  if (series.length === 0) return <p style={{ color: 'var(--muted)' }}>No test results yet. Runs report them with <code className="font-mono">loop runs log --passed N --failed N</code>.</p>;
  const latest = series[series.length - 1]!;
  const failure = lastFailure(series);
  const max = Math.max(...series.map((p) => p.passed + p.failed), 1);
  const step = W / series.length;
  const label = `Tests per recorded run, ${series.length} runs: latest ${latest.passed} passed, ${latest.failed} failed.`;
  return (
    <div className="space-y-4">
      <p data-testid="tests-latest" className="flex items-center gap-2 text-[15px] font-medium" style={{ color: latest.failed > 0 ? 'var(--failing)' : 'var(--done)' }}>
        {latest.failed > 0 ? <XCircle aria-hidden size={18} /> : <CheckCircle2 aria-hidden size={18} />}
        {latest.failed > 0 ? `${latest.failed} failing, ${latest.passed} passing` : latest.passed + latest.failed === 0 ? 'No tests ran' : `${latest.passed} ${latest.passed === 1 ? 'test passes' : 'tests pass'}`}
        <span className="text-[12px] font-normal" style={{ color: 'var(--muted)' }}>{stamp(latest.at)}</span>
      </p>
      <p data-testid="tests-last-failure" style={{ color: 'var(--muted)' }}>
        {failure ? `Last failure: ${failure.failed} failing on ${stamp(failure.at)}${failure.lane ? `, lane ${failure.lane}` : ''}.` : 'No failure recorded.'}
      </p>
      <figure className="rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <figcaption className="mb-1 text-[12px]" style={{ color: 'var(--muted)' }}>Tests per recorded run, oldest to newest</figcaption>
        <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="h-24 w-full">
          {series.map((p, i) => {
            const total = p.passed + p.failed;
            const h = Math.max(2, (total / max) * (H - 4));
            const failH = p.failed > 0 ? Math.max(2, (p.failed / total) * h) : 0;
            const x = i * step + 1;
            const w = Math.max(step - 2, 1);
            return (
              <g key={`${p.at}-${i}`}>
                <rect x={x} y={H - h} width={w} height={h - failH} fill="var(--accent)" />
                {failH > 0 && <rect x={x} y={H - failH} width={w} height={failH} fill="var(--failing)" />}
                <title>{`${stamp(p.at)}: ${p.passed} passed, ${p.failed} failed`}</title>
              </g>
            );
          })}
        </svg>
        <table className="sr-only">
          <caption>Tests per recorded run</caption>
          <thead><tr><th scope="col">Run</th><th scope="col">Passed</th><th scope="col">Failed</th></tr></thead>
          <tbody>{series.map((p, i) => <tr key={`${p.at}-${i}`}><td>{stamp(p.at)}</td><td>{p.passed}</td><td>{p.failed}</td></tr>)}</tbody>
        </table>
      </figure>
    </div>
  );
}
