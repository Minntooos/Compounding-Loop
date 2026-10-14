import { useQuery } from '@tanstack/react-query';
import type { EvalRow } from '@core/types';
import { api } from '../api/client';
import { ARM_LABEL, secondsText, tokensText } from '../lib/knowledge';
import { LoadError, Loading } from './QueryState';

const th = 'px-2 py-1.5 text-left font-medium';

function Table({ rows }: { rows: EvalRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }} tabIndex={0} role="region" aria-label="Eval results table">
      <table data-testid="eval-table" className="w-full min-w-[560px] border-collapse text-[13px]">
        <thead style={{ background: 'var(--surface)' }}>
          <tr><th scope="col" className={th}>Task</th><th scope="col" className={th}>Arm</th><th scope="col" className={th}>Model</th><th scope="col" className={th}>Passed</th><th scope="col" className={th}>Tokens</th><th scope="col" className={th}>Time</th><th scope="col" className={th}>Turns</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.task}/${r.arm}/${r.model}`} className="border-t" style={{ borderColor: 'var(--border)' }}>
              <th scope="row" className="px-2 py-1.5 text-left font-mono font-normal">{r.task}</th>
              <td className="px-2 py-1.5">{ARM_LABEL[r.arm]}</td>
              <td className="px-2 py-1.5 font-mono">{r.model}</td>
              <td className="px-2 py-1.5 font-medium" style={{ color: r.passed === r.runs ? 'var(--done)' : r.passed === 0 ? 'var(--failing)' : 'var(--text)' }}>{r.passed}/{r.runs}</td>
              <td className="px-2 py-1.5">{tokensText(r.medianTokens)}</td>
              <td className="px-2 py-1.5">{secondsText(r.medianSeconds)}</td>
              <td className="px-2 py-1.5">{r.medianTurns}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Round 6 eval: does a recipe or a trigger make the same task pass more often with fewer tokens. Demo numbers are labelled Sample data. */
export function EvalView() {
  const q = useQuery({ queryKey: ['eval'], queryFn: () => api.eval() });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError what="the eval" onRetry={() => void q.refetch()} busy={q.isFetching} />;
  const { rows, headline, sample, command } = q.data;
  return (
    <section aria-labelledby="eval-h" data-testid="eval" className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id="eval-h" className="text-[15px] font-semibold">Eval: does memory help?</h3>
        {sample && <span data-testid="sample-badge" className="rounded border px-1.5 py-0.5 text-[12px] font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Sample data</span>}
      </div>
      {rows.length === 0 ? (
        <div data-testid="eval-empty" className="space-y-1">
          <p style={{ color: 'var(--muted)' }}>No eval results yet. Run the same task cold and with a recipe, then compare:</p>
          <code className="inline-block break-all rounded px-1.5 py-0.5 font-mono text-[13px]" style={{ background: 'var(--surface)' }}>{command}</code>
        </div>
      ) : (
        <>
          {headline && <p data-testid="eval-headline" className="font-medium">{headline}</p>}
          <Table rows={rows} />
          {sample && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>These numbers are invented for the demo. Run <code>{command}</code> to measure your own.</p>}
        </>
      )}
    </section>
  );
}
