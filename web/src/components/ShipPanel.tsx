import { Check, X } from 'lucide-react';
import type { LoopDetail } from '@core/types';

const MAX_FINDINGS = 5;

/** "Ready to ship" checklist from core's ship-check; findings are repo text, shown as text nodes. */
export function ShipPanel({ ship }: { ship: NonNullable<LoopDetail['ship']> }) {
  const findings = ship.openFindings;
  return (
    <section aria-labelledby="ship-heading" data-testid="ship-panel" className="rounded-lg border p-3 sm:p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <h2 id="ship-heading" className="text-[15px] font-semibold">{ship.ready ? 'Ready to ship' : 'Not ready to ship'}</h2>
      <ul className="mt-2 space-y-1">
        {ship.items.map((i) => (
          <li key={i.id} className="flex items-start gap-2" style={{ color: i.ok ? 'var(--done)' : 'var(--failing)' }}>
            {i.ok ? <Check aria-label="Passes" size={16} className="mt-0.5 shrink-0" /> : <X aria-label="Fails" size={16} className="mt-0.5 shrink-0" />}
            <span style={{ color: 'var(--text)' }}>{i.label}<span style={{ color: 'var(--muted)' }}> · {i.detail}</span></span>
          </li>
        ))}
      </ul>
      {findings.length > 0 && (
        <details className="mt-3" open={findings.length <= MAX_FINDINGS}>
          <summary className="min-h-11 cursor-pointer py-2 font-medium">{findings.length} open {findings.length === 1 ? 'finding' : 'findings'}</summary>
          <ul className="list-disc space-y-1 pl-5 [overflow-wrap:anywhere]">{findings.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </details>
      )}
    </section>
  );
}
